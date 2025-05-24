import { Worker } from 'node:worker_threads';
import * as path from 'path';
import * as fs from 'fs/promises';
import { MessageType, Status } from '../types';

describe('Files Worker Integration Tests', () => {
    const testDir = path.join(__dirname, '../test-files');
    const workerPath = path.join(__dirname, '../files-worker.ts');
    let worker: Worker;

    beforeEach(async () => {
        // Create test directory
        await fs.mkdir(testDir, { recursive: true });
        worker = new Worker(workerPath);
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(testDir, { recursive: true, force: true });
        await worker.terminate();
    });

    describe('writeBufferToFile', () => {
        it('should create directory and write file if directory does not exist', async () => {
            const testPath = path.join(testDir, 'nested/dir/test.txt');
            const testData = Buffer.from('test data');

            const result = await new Promise<void>((resolve, reject) => {
                worker.on('message', (message) => {
                    if (message.type === MessageType.writeToFile && message.status === Status.done) {
                        resolve();
                    }
                });

                worker.on('error', reject);

                worker.postMessage({
                    type: MessageType.writeToFile,
                    path: testPath,
                    buffer: testData,
                    id: 'test1',
                    contentLength: testData.length,
                    isEOF: true
                });
            });

            // Verify file was written
            const fileContent = await fs.readFile(testPath);
            expect(fileContent.toString()).toBe('test data');
        });

        it('should append data to existing file', async () => {
            const testPath = path.join(testDir, 'append.txt');
            const initialData = Buffer.from('initial ');
            const appendData = Buffer.from('appended');

            // Write initial data
            await new Promise<void>((resolve) => {
                worker.on('message', (message) => {
                    if (message.type === MessageType.writeToFile && message.status === Status.done) {
                        resolve();
                    }
                });

                worker.postMessage({
                    type: MessageType.writeToFile,
                    path: testPath,
                    buffer: initialData,
                    id: 'test2',
                    contentLength: initialData.length,
                    isEOF: true
                });
            });

            // Append data
            await new Promise<void>((resolve) => {
                worker.on('message', (message) => {
                    if (message.type === MessageType.writeToFile && message.status === Status.done) {
                        resolve();
                    }
                });

                worker.postMessage({
                    type: MessageType.writeToFile,
                    path: testPath,
                    buffer: appendData,
                    id: 'test3',
                    contentLength: appendData.length,
                    isEOF: true
                });
            });

            // Verify final content
            const fileContent = await fs.readFile(testPath);
            expect(fileContent.toString()).toBe('initial appended');
        });
    });

    describe('swapFiles', () => {
        it('should swap two existing files', async () => {
            const file1Path = path.join(testDir, 'file1.txt');
            const file2Path = path.join(testDir, 'file2.txt');

            // Create initial files
            await fs.writeFile(file1Path, 'file1 content');
            await fs.writeFile(file2Path, 'file2 content');

            await new Promise<void>((resolve) => {
                worker.on('message', (message) => {
                    if (message.type === MessageType.swapFiles && message.status === Status.done) {
                        resolve();
                    }
                });

                worker.postMessage({
                    type: MessageType.swapFiles,
                    sourceFilePath: file1Path,
                    destinationFilePath: file2Path,
                    id: 'test4'
                });
            });

            // Verify files were swapped
            const file2Content = await fs.readFile(file2Path);
            expect(file2Content.toString()).toBe('file1 content');
        });

        it('should handle non-existent destination directory', async () => {
            const sourceFilePath = path.join(testDir, 'source.txt');
            const destinationFilePath = path.join(testDir, 'nested/dir/dest.txt');

            // Create source file
            await fs.writeFile(sourceFilePath, 'source content');

            await new Promise<void>((resolve) => {
                worker.on('message', (message) => {
                    if (message.type === MessageType.swapFiles && message.status === Status.done) {
                        resolve();
                    }
                });

                worker.postMessage({
                    type: MessageType.swapFiles,
                    sourceFilePath,
                    destinationFilePath,
                    id: 'test5'
                });
            });

            // Verify file was moved
            const destinationContent = await fs.readFile(destinationFilePath);
            expect(destinationContent.toString()).toBe('source content');
            await expect(fs.access(sourceFilePath)).rejects.toThrow();
        });
    });

}); 