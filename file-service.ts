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



export async function writeLineToFile(fileName: string, line: string) {
    fs.appendFileSync(fileName, line + "\n")
}