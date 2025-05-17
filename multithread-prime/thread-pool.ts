import { Worker } from 'node:worker_threads';

export class ThreadPool {
    private threads: Array<Worker> = [];
    private threadsStatus: Array<boolean> = [];
    private numOfWorkers: number = 10;
    private primeCount: number = 0;
    private workloadCount: number = 0;

    constructor(workerPath: string, numOfWorkers: number) {
        this.threads = [];
        this.numOfWorkers = numOfWorkers;
        this.threadsStatus = Array.from({ length: this.numOfWorkers }, () => false);
        
        // Create workers directly, not as promises
        for(let i = 0; i < this.numOfWorkers; i++) {
            const worker = new Worker(workerPath);
            worker.on('message', (message) => {
                if(typeof message === "object" && message.primeCount&&message.id===i){ 
                    this.primeCount += message.primeCount;
                    // console.log(`worker ${i} finished`)
                    this.threadsStatus[i] = false;
                }
                if(typeof message === "object" && message.id === i && message.message === "started"){ 
                    // console.log(`Worker ${i} started`)
                    this.threadsStatus[i] = true;
                }
            });

            this.threads.push(worker);
        }
    }
    sendWork(numbers: number[]) {
        const currentIndex = this.workloadCount%this.threadsStatus.length;
        const freeThreadIndex = this.threadsStatus[currentIndex] ? this.threadsStatus.findIndex((status) => status === false) : currentIndex;
        if(freeThreadIndex === -1) {
            console.log("No free threads")
            return new Promise((resolve) => {
                setTimeout(() => {
                    resolve(this.sendWork(numbers));
                }, 100);
            });
        }
        this.workloadCount++;
        const worker = this.threads[freeThreadIndex]!;
        return new Promise((resolve) => {
            resolve(worker.postMessage({numbers,id: freeThreadIndex}));
        });
    }
    async tearUp(): Promise<void> {
        console.log("Threads count: ", this.threads.length)
        if(this.threadsStatus.some((status) => status === true)) {
            console.log("Waiting for threads to finish")
            await new Promise((resolve) => setTimeout(resolve, 100));
            return await this.tearUp();
        }
        for(const worker of this.threads) {
            await worker.terminate();
        }
    }
    getPrimeCount() {
        return this.primeCount;
    }
}