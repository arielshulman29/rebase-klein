/*
Given an input text file, named input.txt, that contains 5,000,000 (5 million lines)
each line contains up to 10,000 characters (in pure ASCII), 
create an output file, named output.txt, so that it contains only unique text lines, not necessarily in the original order.

Limitations
Pure code
Single machine, with:
1 CPU
8 GB of RAM
500 GB of disk size
*/

/*
Calculations:
10k chars = 10KB 
5,000,000 lines = 5,000,000*10KB = 50,000,000KB = 50GB

Strategy:
create a hash function that would represent the content of a line
we actually don't need to know what the hash represents, just if it already appeared
we process line by line and hash the row content and check if is already in the hashset
if it is not, we add it and write it to the output file
if it is, we skip it

in the worst case where each row is unique then we will have 5,000,000*hash size
if we try to implement SHA1 for example, that creates a 20byte hash
then we will have 5,000,000*20 = 100,000,000 bytes = 100MB
*/


import { readLineFromFile, writeLineToFile } from '../file-service.ts'
import { HashSet } from './hashmap.ts';

const linesHashes = new HashSet();

export default async function dedupe() {
    for await (const line of readLineFromFile('./example.txt')) {
        if (linesHashes.has(line)) {
            console.log('line already exists', line);
        } else {
            console.log('adding line', line);
            linesHashes.add(line);
            writeLineToFile('./output.txt', line);
        }
    }
}

dedupe();
