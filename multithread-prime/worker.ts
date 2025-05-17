import { PrimeCounter } from "./prime-counter.ts"
import { parentPort, workerData } from "node:worker_threads"


parentPort?.on('message', (numbers: number[]) => {
    const primeCounter = new PrimeCounter()
    console.log(`Worker received ${numbers.length} numbers`)
    primeCounter.countPrimes(numbers)
    const primeCount = primeCounter.getPrimeCount()
    console.log(`prime count: ${primeCount} numbers: ${numbers.length}`)
    parentPort?.postMessage(primeCount)
});
