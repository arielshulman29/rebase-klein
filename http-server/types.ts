export type BlobStats = {
    id: string;
    headersCount: number;
    totalSize: number;
}

export const Status = {
    started : 'started',
    done : 'done',
    error : 'error',
    processed : 'processed'
} as const;


export const MessageType = {
    writeToFile : 'writeToFile',
    swapFiles : 'swapFiles',
} as const;

export type WorkerPayload = {
    type: typeof MessageType.writeToFile
    path: string;
    buffer: Buffer<ArrayBuffer>;
    id: string;
    contentLength: number;
    isEOF: boolean;
} | {
    type: typeof MessageType.swapFiles
    sourceFilePath: string;
    destinationFilePath: string;
    id: string;
}


export type WorkerResponse = {
    type: typeof MessageType.writeToFile
    status: typeof Status.processed | typeof Status.done
    id: string;
    count: number;
} | {
    type: typeof MessageType.swapFiles
    status: typeof Status.done
}