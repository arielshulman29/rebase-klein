/*
Given a text input file, say input.txt, with a single number in each line, 
your task is to print (stdout) how many prime numbers are in this file + how long did it take.

utilize all CPU cores you have 💪

Limitations
Pure code
Single machine, with:
multicore CPU (with at least 2 cores)
500MB of RAM
30GB of disk size
file size - 430MB (small one)
file size - 1.8GB (big one)

Calculations:
1 number - 8 bytes
50,000,000 lines = 50,000,000*8bytes = 400,000,000 bytes = 400MB
200,000,000 lines = 200,000,000*8bytes = 1,600,000,000 bytes = 1,600MB = 1.6GB

1m numbers = 1M*8bytes = 8,000,000 bytes = 8MB
8MB*16 = 128MB per 16 cores
if we have max 16 chunks int he queue that's another 128MB
so all together 256MB


Strategy:
start without multithreading:
- start timer
- create a queue of numbers to check
- we're goint to read the file in chunks and push each chunk to the queue
- read the file line by line
- enqueue each chunk of numbers
- for each chunk, count the number of primes
- when the file is read, print the prime count and the time it took

then, with multithreading:
- start timer
- create a counter array with the length of the number of cores
- create a queue of chunks of numbers to check
- instantiate a thread pool with the number of cores
- for each core, dequeue a chunk of numbers and check if they are prime
- if they are prime, increment the prime count
- when the file is read, print the prime count and the time it took
*/
import { readChunkOfNumbersFromFile } from "../file-service.ts"
import { ThreadPool } from "./thread-pool.ts"


class ReadFileToQueue {
    private numbersQueue: number[][] = [];
    private chunkGenerator: AsyncGenerator<number[], void>;
    private maxQueueSize: number = 10;
    done: boolean = false;

    constructor(filePath: string, chunkSize: number, maxQueueSize: number) {
        this.chunkGenerator = readChunkOfNumbersFromFile(filePath, chunkSize);
        this.maxQueueSize = maxQueueSize;
    }

    async enqueueChunk(chunkCount?: number) {
        if(this.numbersQueue.length >= this.maxQueueSize || this.done) return;
        for(let i = 0; i < (chunkCount || this.maxQueueSize); i++) {
            const chunk = await this.chunkGenerator.next()
            if(chunk.done) {
                this.done = true;
                return;
            }
            this.numbersQueue.push(chunk.value);
        }
    }

    async* dequeueChunk() {
        while (this.numbersQueue.length > 0) {
            const chunk = this.numbersQueue.shift();
            yield chunk;
            if(this.numbersQueue.length < this.maxQueueSize) await this.enqueueChunk(2);
        }
    }
    [Symbol.asyncIterator]() {
        return this.dequeueChunk();
    }
    
}


// async function largeScalePrimeCountSingleThreaded(filePath: string) {
//     const startTime = performance.now();
//     const primeCounter = new PrimeCounter();
//     const numbersQueue = new ReadFileToQueue(filePath, 10_000, 16);
//     let chunkCount = 0;
//     await numbersQueue.enqueueChunk();
//     for await (const chunk of numbersQueue) {
//         chunkCount++;
//         if(chunkCount % 100 === 0) console.log(`Chunk: ${chunkCount}`);
//         if(chunk) primeCounter.countPrimes(chunk);
//         await numbersQueue.enqueueChunk();
//     }
//     const endTime = performance.now();
//     console.log(`Prime count: ${primeCounter.getPrimeCount()} Time it took: ${(endTime - startTime)/1000} seconds`);
// }

async function largeScalePrimeCountMultiThreaded(filePath: string) {
    const startTime = performance.now();
    const threadPool = new ThreadPool("./worker.ts", 16);
    const numbersQueue = new ReadFileToQueue(filePath, 1_000_000, 10);
    let chunkCount = 0;
    await numbersQueue.enqueueChunk();
    for await (const chunk of numbersQueue) {
        chunkCount++;
        console.log(`Chunk: ${chunkCount}`);
        if(chunk) await threadPool.sendWork(chunk);
    }
    await threadPool.tearUp();
    const primeCount = threadPool.getPrimeCount();
    const endTime = performance.now();
    console.log(`Prime count: ${primeCount} Time it took: ${(endTime - startTime)/1000} seconds`);
}
// largeScalePrimeCountMultiThreaded("./smallTest.txt") //took 0.001 seconds
const asyncWrapper = async (func: () => Promise<void>) => {
    await func();
}
asyncWrapper(()=>largeScalePrimeCountMultiThreaded("./nums_50_mil.txt"));
// asyncWrapper(()=>largeScalePrimeCountMultiThreaded("./smallTest.txt"));
//suposebly from the small file we should have 46 primes (23 not prime)
// largeScalePrimeCountSingleThreaded("nums_50_mil.txt") //took 363.559 seconds