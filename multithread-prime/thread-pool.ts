import { Worker } from 'node:worker_threads';

export class ThreadPool {
    private threads: Array<Worker> = [];
    private threadsStatus: Array<boolean> = [];
    private numOfWorkers: number = 10;
    private primeCount: number = 0;

    constructor(workerPath: string, numOfWorkers: number) {
        this.threads = [];
        this.numOfWorkers = numOfWorkers;
        this.threadsStatus = Array.from({ length: this.numOfWorkers }, () => false);
        
        // Create workers directly, not as promises
        for(let i = 0; i < this.numOfWorkers; i++) {
            const worker = new Worker(workerPath);
            worker.on('message', (message) => {
                console.log(`Worker ${i} sent message ${message}`)
                if(typeof message === "number"){ 
                    this.primeCount += message;
                    console.log(`Prime count: ${this.primeCount}`)
                }
            });

            this.threads.push(worker);
        }
    }
    sendWork(numbers: number[]) {
        const freeThreadIndex = this.threadsStatus.findIndex((status) => status === false);
        
        const worker = this.threads[freeThreadIndex]!;
        this.threadsStatus[freeThreadIndex] = true;
        return new Promise((resolve) => {
            this.threadsStatus[freeThreadIndex] = false;
            resolve(worker.postMessage(numbers));
            this.threadsStatus[freeThreadIndex] = true;
            
        });
    }
    tearUp() {
        for(const worker of this.threads) {
            worker.terminate();
        }
    }
    getPrimeCount() {
        return this.primeCount;
    }
}