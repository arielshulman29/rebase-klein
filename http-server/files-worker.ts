import { parentPort } from "node:worker_threads"
import { writeBufferToFile, swapFiles } from "../file-service"
import { MessageType, Status, WorkerPayload, WorkerResponse } from "./types"


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
