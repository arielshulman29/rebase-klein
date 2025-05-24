/*
The task: 
Implement an HTTP server with the following API:

POST /blobs/{id}
Payload: binary

If the blob already exists - overwrite it ("upsert")

Some headers, if sent, should also be stored. These headers are:

1. Content-Type
2. Any header that starts with x-rebase- (case insensitive)

Possible errors:
missing Content-Length header
sum(Binary length, stored headers length) exceeds MAX_LENGTH
Overall disk space, if potentially storing this blob, exceeds MAX_DISK_QUOTA
Any of the stored header (including key and value) exceeds MAX_HEADER_LENGTH
count(stored-headers) exceeds MAX_HEADER_COUNT
id should include only the following characters: a-z, A-Z, 0-9, dot (.), underscore (_), minus (-). Any other character is not valid.
id should not exceed MAX_ID_LENGTH

GET /blobs/{id}
Return the relevant blob and its stored headers, if they exist.

If the Content-Type header does not exist in the stored headers, either use the value application/octet-stream or try to infer it using an external lib (e.g. mime-types)

Possible errors
Non existing blob (404)

DELETE /blobs/{id}
Delete an existing blob

There's no need to return 404 if the blob doesn't exist


Limitations
The server should be able to run on a modest machine in terms of RAM, so you should not read the entire input stream at once and then store it as a file.
Instead, you should read it chunk by chunk and store the chunks on the disk. 
Same goes for serving a blob. (in nodejs there are streams and pipes for that)

For performance reasons, you should not store all more than MAX_BLOBS_IN_FOLDER blobs directly under a given folder.
The solution should be consistent even when the requests break. E.g. disk quota should be recalculated if a POST request was broken while it was being processed.
You can use an HTTP framework/lib of your choice.

MAX_LENGTH = 10MB
MAX_DISK_QUOTA = 1 GB
MAX_HEADER_LENGTH = 50
MAX_HEADER_COUNT = 20
MAX_ID_LENGTH = 200
MAX_BLOBS_IN_FOLDER = 10000

Notes
You may assume that there are no concurrent requests to the same id
It's a common practice to perform some calculations and cleanups when the server is launched. 
However, while warming up, the server should not listen to incoming requests
Headers are in pure ASCII
Storing data can be done only on the file system
You can assume that you have at least 1.5 * MAX_DISK_QUOTA available on the local disk
*/

/*
Strategy:
we will have an http server singelton that is in charge of vacant disk space and orchestrates the requests between different worker threads.
the strategy for storing the requests on file system is:
we will have a hasmap of a SHA1 hash of the id of the request so we can (hopefully) spread the requests evenly between the folders.

(a bit of Git inspiration 😊)
 -blobs
    - first 2 chars of the hash 
        -{hash of the id}
            payload.bin
            headers.txt

 -temp-blobs (temp blobs can be flat because we're making an assumption that we won't get requests with the same id concurrently)
    -{id}
        payload.bin
        headers.txt

Consistency Tradeoff:
because storage is limitted both in size and in structure- and we are working concurrently-
we could experience race conditions in the following cases:
- by the time we finished processing a request we already passed disk storage limit
- by the time we finished processing a request we already passed headers count limit
- by the time we finished processing a request we already passed blobs per file limit

this is why we work with temporary files as well- so after a request is succesfully parsed we can check if we need to change storage 
structure or return an error.
this also allows us to keep returning data while processing - I chose to go with eventual consistency 
(in case of overriding data- returning the previous data while the new data is being processed)

we will have a threadpool for writting chunks of data to the disk.
each thread will be in charge of writting a specific file.


processing of a request is done in 3 steps:
1. processing the request headers- 
 in this step if we encounter a request that we know is not valid by any of these conditions:
 -no content-length header  
 -not enough disk space for the content-length
 -any content header that exceeds MAX_HEADER_LENGTH
 -too many blobs in file
 -any of the stored header (including key and value) exceeds MAX_HEADER_LENGTH
 -count(stored-headers) exceeds MAX_HEADER_COUNT
 -id contains invalid characters- so anything not in: a-z, A-Z, 0-9, dot (.), underscore (_), minus (-).
 -id exceeds MAX_ID_LENGTH
 in case of error we will return an error, and not process the payload.
 in case of sucess of this step we should have the following:
 -the headers to store
 -the id
 -the content length
2. using a worker to process the payload and storing it in a temp file on the disk- 
 at first we will try to store the request in a temp file (eg. for id 123 it will be stored in temp-123/), 
 We want to work in a temporary file because content can override existing stored content 
 and we don't want to override the data until we successfully parsed the whole payload.
 so we will start by saving the headers, then read the payload in chunks and store on the disk.
 in case that durring the processing of the payload we exceed the content length we will return an error and remove the temp file
 the worker will return:
 -the path to the temp file
 -the content length
 -the headers to store
 -the id

3. finalizing the request- 
 in this step we will:
 check if storing the file will exceed the disk storage limit/headers count limit/blobs per file limit
 if it will- we will move the temp file to the final location and delete the temp file.
 we will also update the disk space and headers count.
 if it won't- we will delete the temp file and return an error.
*/

import { createHash } from 'crypto';
import { ThreadPool } from './thread-pool.ts';
import * as os from "node:os";
import * as path from 'node:path';
import { readFile } from 'node:fs/promises';
import * as express from 'express';
import * as fs from 'node:fs';
import { pipeline, Writable } from 'node:stream';
import { hasFile } from '../file-service.ts';
import type { IncomingHttpHeaders } from 'node:http';
import { MessageType, type WorkerPayload } from './types.ts';

export const MAX_LENGTH = 10_000_000;
export const MAX_DISK_QUOTA = 1_000_000_000;
export const MAX_HEADER_LENGTH = 100;
export const MAX_HEADER_COUNT = 20;
export const MAX_ID_LENGTH = 200;
export const MAX_BLOBS_IN_FOLDER = 10000

const sha1Hashed = Symbol('sha1Hashed');
type Hashed = string & { __brand: typeof sha1Hashed }
function hashString(str: string): Hashed {
    return createHash('sha1').update(str).digest('hex') as Hashed;
}

export class HttpServer {
    private readonly blobsFolder: string;
    private readonly tempBlobsFolder: string;
    private readonly filesWorkerPath: string;

    takenDiskSpace: number = 0;
    headersCount: number = 0;
    hashToStats: Map<Hashed, { id: string, headersCount: number, totalSize: number }> = new Map();
    threadPool: ThreadPool | null = null;
    isWarm: boolean = false;



    constructor(blobsFolderPath: string, tempBlobsFolderPath: string, filesWorkerPath: string) {
        this.takenDiskSpace = 0;
        this.headersCount = 0;
        this.blobsFolder = blobsFolderPath;
        this.tempBlobsFolder = tempBlobsFolderPath;
        this.filesWorkerPath = filesWorkerPath;
    }

    async warmUp() {
        // request finalizers are for storing data but we want to maintain more of the resources for also handling requests
        this.threadPool = new ThreadPool(this.filesWorkerPath, os.cpus().length);
        await this.threadPool.getIsWarm();
        this.isWarm = this.threadPool.isWarm;
        return this.isWarm;
    }

    async tearDown() {
        await this.threadPool!.tearDown();
    }

    private getPathOfPayload(id: string): string {
        const hash = hashString(id);
        return path.join(this.blobsFolder, hash.slice(0, 2), hash, "payload.bin");
    }

    private getPathOfHeaders(id: string): string {
        const hash = hashString(id);
        return path.join(this.blobsFolder, hash.slice(0, 2), hash, "headers.txt");
    }

    async get(id: string, res: express.Response) {
        if (!hasFile(this.getPathOfPayload(id))) {
            res.status(404).send("Not Found");
            return;
        }
        const headers = new Map<string, string>();
        try {
            const headersBuffer = await readFile(this.getPathOfHeaders(id));
            headersBuffer.toString().split("\n").forEach((line) => {
                const [key, value] = line.split(": ");
                if (key && value) {
                    headers.set(key, value);
                }
            });
        } catch (error) { }
        if (!headers.get("content-type")) {
            headers.set("content-type", "application/octet-stream");
        }
        res.setHeaders(headers);
        const pathOfPayload = this.getPathOfPayload(id);
        const readStream = fs.createReadStream(pathOfPayload);
        pipeline(readStream, res, (err) => {
            if (err) {
                console.error('Pipeline failed', err);
                res.status(500).send('Something went wrong');
            }
        });
    }

    processHeaders(headers: IncomingHttpHeaders): [Buffer<ArrayBuffer>, number, number] {
        if (!headers['content-length']) {
            throw new Error(`Content-Length header is missing`);
        }
        const processedHeaders: Record<string, string> = {};
        let headersSize = 0;
        let headersCount = 0;
        let headersString = "";
        for (const [key, value] of Object.entries(headers)) {
            if (key && value && (key.toLowerCase().startsWith("x-rebase-") || key.toLowerCase() === "content-type")) {
                if (key.length + value.length > MAX_HEADER_LENGTH) {
                    throw new Error(`Header ${key} length exceeds ${MAX_HEADER_LENGTH} characters`);
                }
                processedHeaders[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
                headersSize += key.length + value.length;
                headersCount++;
                headersString += `${key}: ${value}\n`;
            }
        }
        const processedHeadersBuffer = Buffer.from(headersString);
        return [processedHeadersBuffer, headersSize, headersCount];
    }

    async post(id: string, req: express.Request, res: express.Response) {
        if (id.length > MAX_ID_LENGTH) {
            res.status(400).send(`Id length exceeds maximum ${MAX_ID_LENGTH}`);
            return;
        }
        if (!(id.match(/^[a-zA-Z0-9._-]+$/))) {
            res.status(400).send(`Id contains invalid characters. Allowed characters: a-z, A-Z, 0-9, dot (.), underscore (_), minus (-).`);
            return;
        }
        const [processedHeaders, headersSize, headersCount] = this.processHeaders(req.headers);
        if (headersCount + this.headersCount > MAX_HEADER_COUNT) {
            throw new Error(`Headers size exceeds maximum`);
        }
        const headersWorkerId = await this.threadPool!.getAvailableWorkerId();
        const payloadWorkerId = await this.threadPool!.getAvailableWorkerId();
        const tempHeadersPath = path.join(this.tempBlobsFolder, id, "headers.txt");
        const tempPayloadPath = path.join(this.tempBlobsFolder, id, "payload.bin");
        const contentLength = parseInt(req.headers['content-length']!);
        let payloadSize = 0;
        const sendPayloadToWorker = async (chunk: Buffer<ArrayBuffer>, path: string) => {
            if ((payloadSize + chunk.length) > contentLength) {
                throw new Error(`Content-Length header is invalid. Content-Length: ${contentLength}, Payload size: ${payloadSize}`);
            }
            payloadSize += chunk.length;
            const isEOF = payloadSize === contentLength;
            const payload: WorkerPayload = { type: MessageType.writeToFile, path, buffer: chunk, id, contentLength: payloadSize, isEOF };
            await this.threadPool!.sendBufferToWorker(payload, payloadWorkerId);
        }
        const sendHeadersToWorker = async (chunk: Buffer<ArrayBuffer>, path: string) => {
            const payload: WorkerPayload = { type: MessageType.writeToFile, path, buffer: chunk, id, contentLength: chunk.length, isEOF: true };
            await this.threadPool!.sendBufferToWorker(payload, headersWorkerId);
            this.threadPool!.freeWorker(headersWorkerId);
        }
        await sendHeadersToWorker(processedHeaders, tempHeadersPath);

        const writable = new Writable({
            write(this, chunk, encoding, callback) {
                sendPayloadToWorker(chunk, tempPayloadPath);
                callback();
            }
        });

        req.pipe(writable);

        req.on('error', (err) => {
            console.error('Request error:', err);
            res.status(500).send(`Stream error: ${err.message}`);
        });

        req.on('end', () => {
            this.threadPool!.freeWorker(payloadWorkerId);
            this.finalizeRequest(id, tempPayloadPath, tempHeadersPath, headersSize, headersCount, contentLength);
            res.send('Upload complete');
        });


    };

    async finalizeRequest(id: string, payloadPath: string, headersPath: string, headersLength: number, headersCount: number, contentLength: number) {
        if ((headersLength + contentLength + this.takenDiskSpace) > MAX_DISK_QUOTA) {
            throw new Error(`Disk quota exceeded`);
        }
        if ((this.headersCount + headersCount) > MAX_HEADER_COUNT) {
            throw new Error(`Headers count exceeds maximum`);
        }
        const hash = hashString(id);
        const currentHeadersCount = this.hashToStats.get(hash)?.headersCount || 0;
        const currentPayloadSize = this.hashToStats.get(hash)?.totalSize || 0;
        const destinationPayloadPath = path.join(this.blobsFolder, hash.slice(0, 2), hash, "payload.bin");
        const destinationHeadersPath = path.join(this.blobsFolder, hash.slice(0, 2), hash, "headers.txt");
        const workerId = await this.threadPool!.getAvailableWorkerId();
        await this.threadPool!.sendSwapFilesToWorker(payloadPath, destinationPayloadPath, workerId);
        this.threadPool!.freeWorker(workerId);
        const workerId2 = await this.threadPool!.getAvailableWorkerId();
        await this.threadPool!.sendSwapFilesToWorker(headersPath, destinationHeadersPath, workerId2);
        this.threadPool!.freeWorker(workerId2);
        this.hashToStats.set(hash, { id, headersCount: headersLength, totalSize: headersLength + contentLength });
        this.headersCount -= currentHeadersCount;
        this.headersCount += headersLength;
        this.takenDiskSpace -= (currentPayloadSize + currentHeadersCount);
        this.takenDiskSpace += (headersLength + contentLength);
    }
}

