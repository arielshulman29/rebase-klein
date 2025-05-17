import * as readline from 'node:readline/promises';
import * as fs from 'node:fs';



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



export async function writeLineToFile(fileName: string, line: string) {
    fs.appendFileSync(fileName, line + "\n")
}