export type BlobStats = {
    id: string;
    headersCount: number;
    totalSize: number;
}

export const enum Status {
    started = 'started',
    done = 'done',
    error = 'error',
    processed = 'processed'
}


export const enum MessageType {
    writeToFile = 'writeToFile',
    swapFiles = 'swapFiles',
}

export type WorkerPayload = {
    type: MessageType.writeToFile
    path: string;
    buffer: Buffer<ArrayBuffer>;
    id: string;
    contentLength: number;
    isEOF: boolean;
} | {
    type: MessageType.swapFiles
    sourceFilePath: string;
    destinationFilePath: string;
    id: string;
}


export type WorkerResponse = {
    type: MessageType.writeToFile
    status: Status.processed | Status.done
    id: string;
    count: number;
} | {
    type: MessageType.swapFiles
    status: Status.done
}