import * as readline from 'node:readline/promises';
import * as fs from 'node:fs';
import * as path from 'node:path';



export async function* readLineFromFile(fileName: string) {
    const fileStream = fs.createReadStream(fileName);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        yield line;
    }
}

export async function* readChunkOfNumbersFromFile(fileName: string, chunkSize: number) {
    const fileStream = fs.createReadStream(fileName);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let chunk: number[] = [];
    for await (const line of rl) {
        chunk.push(parseInt(line.trim()));
        if (chunk.length === chunkSize) {
            yield chunk;
            chunk = [];
        }
    }
    if (chunk.length > 0) {
        yield chunk;
    }
}



export async function hasFile(fileName: string): Promise<boolean> {
    return fs.existsSync(fileName);
}



export async function writeLineToFile(fileName: string, line: string) {
    fs.appendFileSync(fileName, line + "\n")
}



export async function writeBufferToFile(fileName: string, buffer: Buffer) {
    fs.appendFileSync(fileName, buffer)
}

export async function swapFiles(fileNameToOverride: string, fileNameToOverrideWith: string): Promise<void> {
    try {
        if(!fs.existsSync(fileNameToOverride)) {
            const dir = path.dirname(fileNameToOverride);
            if(!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            await fs.rename(fileNameToOverrideWith, fileNameToOverride, (err) => {
                if (err) {
                    throw err;
                }
            });
            return;
        }
        const tempBackup = `${fileNameToOverride}.bak`;
        await fs.rename(fileNameToOverride, tempBackup, (err) => {
            if (err) {
                throw err;
            }
        });
        await fs.rename(fileNameToOverrideWith, fileNameToOverride, (err) => {
            if (err) {
                throw err;
            }
        });
        await fs.rename(tempBackup, fileNameToOverrideWith, (err) => {
            if (err) {
                throw err;
            }
        });
    } catch (err) {
        throw err;
    }
}