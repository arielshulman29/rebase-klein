import { ThreadPool } from '../thread-pool';
import { MessageType, Status, WorkerPayload } from '../types';
import * as path from 'path';

describe('ThreadPool', () => {
    let threadPool: ThreadPool;
    const workerPath = path.join(__dirname, '../files-worker.ts');
    const mockOnDone = jest.fn();
    const mockOnProcessed = jest.fn();

    beforeEach(() => {
        mockOnDone.mockClear();
        mockOnProcessed.mockClear();
        threadPool = new ThreadPool(workerPath, 2, mockOnDone, mockOnProcessed);
    });

    afterEach(async () => {
        await threadPool.tearDown();
    });

    describe('getIsWarm', () => {
        it('should return true when all threads are initialized', async () => {
            const isWarm = await threadPool.getIsWarm();
            expect(isWarm).toBe(true);
        });
    });

    describe('getAvailableWorkerId', () => {
        it('should return different worker IDs for concurrent requests', async () => {
            const workerId1 = await threadPool.getAvailableWorkerId();
            const workerId2 = await threadPool.getAvailableWorkerId();
            
            expect(workerId1).not.toBe(workerId2);
            expect(workerId1).toBeGreaterThanOrEqual(0);
            expect(workerId2).toBeGreaterThanOrEqual(0);
            expect(workerId1).toBeLessThan(2);
            expect(workerId2).toBeLessThan(2);
        });

        it('should wait for worker to become available', async () => {
            // Take all workers
            const workerId1 = await threadPool.getAvailableWorkerId();
            const workerId2 = await threadPool.getAvailableWorkerId();

            // Try to get another worker (should wait)
            const getWorkerPromise = threadPool.getAvailableWorkerId();
            
            // Free one worker
            threadPool.freeWorker(workerId1);
            
            // Should get the freed worker
            const workerId3 = await getWorkerPromise;
            expect(workerId3).toBe(workerId1);
        });
    });

    describe('sendBufferToWorker', () => {
        it('should send buffer to worker successfully', async () => {
            const workerId = await threadPool.getAvailableWorkerId();
            const testBuffer = Buffer.from('test data');
            
            const payload: WorkerPayload = {
                type: MessageType.writeToFile,
                path: 'test.txt',
                buffer: testBuffer,
                id: 'test123',
                contentLength: testBuffer.length,
                isEOF: true
            };

            await expect(threadPool.sendBufferToWorker(payload, workerId)).resolves.not.toThrow();
        });
    });

    describe('sendSwapFilesToWorker', () => {
        it('should send swap files command to worker successfully', async () => {
            const workerId = await threadPool.getAvailableWorkerId();
            
            await expect(threadPool.sendSwapFilesToWorker(
                'source.txt',
                'destination.txt',
                workerId
            )).resolves.not.toThrow();
        });
    });

    describe('tearDown', () => {
        it('should terminate all workers', async () => {
            const workerId = await threadPool.getAvailableWorkerId();
            await threadPool.freeWorker(workerId);
            
            await expect(threadPool.tearDown()).resolves.not.toThrow();
        });
    });
}); 