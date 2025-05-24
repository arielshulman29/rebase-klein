import { parentPort } from "node:worker_threads"
import * as fs from "node:fs"
import * as fsPromises from "node:fs/promises"
import * as path from "node:path"


const Status ={
    started : 'started',
    done : 'done',
    error : 'error',
    processed : 'processed'
} as const


const MessageType = {
    writeToFile : 'writeToFile',
    swapFiles : 'swapFiles',
} as const

type WorkerPayload = {
    type: typeof MessageType.writeToFile;
    path: string;
    buffer: Buffer<ArrayBuffer>;
    id: string;
    contentLength: number;
    isEOF: boolean;
} | {
    type: typeof MessageType.swapFiles;
    sourceFilePath: string;
    destinationFilePath: string;
    id: string;
}


export type WorkerResponse = {
    type: typeof MessageType.writeToFile;
    status: typeof Status.processed | typeof Status.done;
    id: string;
    count: number;
} | {
    type: typeof MessageType.swapFiles;
    status: typeof Status.done;
}


parentPort?.on('message', async (payload: WorkerPayload) => {
    switch (payload.type) {
        case MessageType.writeToFile:
            const { id, path, buffer, contentLength, isEOF } = payload;
            await writeBufferToFile(path, buffer);
            const status = isEOF ? Status.done : Status.processed;
            const count = isEOF ? contentLength : buffer.length;
            const response: WorkerResponse = { type: MessageType.writeToFile, id, status, count };
            parentPort?.postMessage(response);
            break;
        case MessageType.swapFiles:
            await swapFiles(payload.sourceFilePath, payload.destinationFilePath);
            parentPort?.postMessage({ type: MessageType.swapFiles, id: payload.id, status: Status.done })
            break;
    }
});



export async function writeBufferToFile(fileName: string, buffer: Buffer) {
    console.log(`Writing buffer to ${fileName}`);
    const dir = path.dirname(fileName);
    try {
        // Ensure the directory exists
        await fsPromises.mkdir(dir, { recursive: true });
        // Append the data
        await fsPromises.appendFile(fileName, buffer);
        console.log(`Appended data to ${fileName}`);
    } catch (err) {
        console.error('Error writing to file:', err);
    }
}

export async function swapFiles(sourceFileName: string, targetFileName: string): Promise<void> {
    try {
        if(!sourceFileName) {
            return Promise.resolve();
        }
        if(!fs.existsSync(targetFileName)) {
            const dir = path.dirname(targetFileName);
            if(!fs.existsSync(dir)) {
                await fsPromises.mkdir(dir, { recursive: true });
            }
        }
        await fsPromises.rename(sourceFileName, targetFileName);
    } catch (err) {
        throw err;
    }
}