import { PrimeCounter } from "./prime-counter.ts"
import { parentPort, workerData } from "node:worker_threads"


parentPort?.on('message', ({numbers, id}: {numbers: number[], id: number}) => {
    parentPort?.postMessage({id, message: "started"})
    const primeCounter = new PrimeCounter()
    // console.log(`Worker received ${numbers.length} numbers`)
    primeCounter.countPrimes(numbers)
    const primeCount = primeCounter.getPrimeCount()
    // console.log(`prime count: ${primeCount} numbers: ${numbers.length}`)
    parentPort?.postMessage({primeCount,id})
});
