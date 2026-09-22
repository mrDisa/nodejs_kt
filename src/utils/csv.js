import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';

export function readLines(filePath) {
  return createInterface({ input: createReadStream(filePath) });
}
