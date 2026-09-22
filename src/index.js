import { access, writeFile } from 'node:fs/promises';

import { loadConfig } from './config/index.js';
import { readLines } from './utils/csv.js';

async function main() {
  const { inputFile, outputFile, minAge, cityFilter } = loadConfig();

  try {
    await access(inputFile);
  } catch {
    throw new Error(`Cant open ${inputFile}. Check INPUT_FILE in .env`);
  }

  let result = '';
  let isHeader = true;
  let processed = 0;
  let matched = 0;

  for await (const line of readLines(inputFile)) {
    if (isHeader) {
      result += line + '\n';
      isHeader = false;
    } else {
      const [id, name, age, city] = line.split(',');

      processed++;

      if (Number(age) >= minAge && city === cityFilter) {
        result += line + '\n';
        matched++;
      }
    }
  }

  await writeFile(outputFile, result);

  console.log(`processed: ${processed}`);
  console.log(`matched: ${matched}`);
}

try {
  await main();
} catch (e) {
  console.error(`err ${e.message}`);
  process.exitCode = 1;
}
