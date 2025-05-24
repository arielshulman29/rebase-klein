import { Worker } from 'node:worker_threads';
import { MessageType, Status, type WorkerResponse, type WorkerPayload } from './types.ts';

export class ThreadPool {
    private threads: Array<Worker> = [];
    private threadsStatus: Array<boolean> = [];
    private numOfWorkers: number = 10;
    isWarm: boolean = false;

    constructor(workerPath: string, numOfWorkers: number) {
        this.threads = [];
        this.numOfWorkers = numOfWorkers;
        this.threadsStatus = Array.from({ length: this.numOfWorkers }, () => false);

        // Create workers directly, not as promises
        for (let i = 0; i < this.numOfWorkers; i++) {
            const worker = new Worker(workerPath);
            //message from worker
            worker.on('message', (message: WorkerResponse) => {
                if (message.type === MessageType.writeToFile) {
                    if(message.status === Status.done) {
                        worker.postMessage({ type: MessageType.writeToFile, id: message.id, status: message.status, count: message.count });
                    } else {
                        worker.postMessage({ type: MessageType.writeToFile, id: message.id, status: message.status, count: message.count });
                    }
                } else if (message.type === MessageType.swapFiles) {
                    if(message.status === Status.done) {
                        worker.postMessage({ type: MessageType.swapFiles, status: message.status });
                    }
                }
            });

            this.threads.push(worker);
        }
    }
    async getIsWarm(maxTries: number = 4): Promise<boolean> {
        if (this.threads.every((thread) => thread.threadId)) {
            this.isWarm = true;
            return true;
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
        return await this.getIsWarm(maxTries - 1);
    }
    sendSwapFilesToWorker(sourceFilePath: string, destinationFilePath: string, workerId: number) {
        const worker = this.threads[workerId]!;
        return new Promise((resolve) => {
            resolve(worker.postMessage({ type: MessageType.swapFiles, sourceFilePath, destinationFilePath }));
        });
    }
    sendBufferToWorker(payload: WorkerPayload, workerId: number) {
        const worker = this.threads[workerId]!;
        return new Promise((resolve) => {
            resolve(worker.postMessage(payload));
        });
    }
    freeWorker(workerId: number) {
        this.threadsStatus[workerId] = false;
    }
    async getAvailableWorkerId(): Promise<number> {
        const currentIndex = this.threadsStatus.findIndex((status) => status === false);
        if (currentIndex === -1) {
            await new Promise((resolve) => setTimeout(resolve, 200));
            return await this.getAvailableWorkerId();
        }
        this.threadsStatus[currentIndex] = true;
        return currentIndex;
    }
    async tearDown(): Promise<void> {
        // Add a timeout to prevent infinite waiting
        const timeout = setTimeout(() => {
            console.warn('Thread pool tearDown timed out - forcing termination');
            for (const worker of this.threads) {
                worker.terminate();
            }
        }, 1000); // 5 second timeout

        try {
            while (this.threadsStatus.some((status) => status === true)) {
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            
            for (const worker of this.threads) {
                await worker.terminate();
            }
        } finally {
            clearTimeout(timeout);
        }
    }
}