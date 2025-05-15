/*
Given an input text file, named input.txt, that contains 5,000,000 (5 million lines)
each line contains up to 10,000 characters (in pure ASCII), 
create an output file, named output.txt, so that it contains only unique text lines, not necessarily in the original order.

Limitations
Pure code
Single machine, with:
1 CPU
1 GB of RAM
500 MB of disk size
*/

/*
Calculations:
1k chars = 1KB 
5,000 lines = 5,000*1KB = 50,000KB = 5MB


Strategy:
create a hash function that would represent the content of a line
we actually don't need to know what the hash represents, just if it already appeared
we process line by line and hash the row content and check if is already in the hashset
if it is not, we add it and write it to the output file
if it is, we skip it

in the worst case where each row is unique then we will have 5,000,000*hash size
if the hash size is 32 bytes
then we will have 5,000*32 = 160,000,000 bytes = 160MB
*/

import { readLineFromFile, writeLineToFile } from "../file-service.ts";
import { HashSet } from "./hashmap.ts";

const linesHashes = new HashSet();

export default async function dedupe() {
  let linesCount = 0;
  for await (const line of readLineFromFile("bigfile_1.txt")) {
    if (!linesHashes.has(line)) {
      linesHashes.add(line);
      writeLineToFile("output.txt", line);
    } else {
      console.log(`index ${linesCount} duplicate line`);
    }
    linesCount++;
  }
  console.log(
    `done. ${linesCount} lines processed. ${linesHashes.count} unique lines written.`
  );
}

dedupe();
