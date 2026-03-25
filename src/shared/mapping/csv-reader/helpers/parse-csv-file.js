// -------- Parse CSV File --------
import { readFile } from 'node:fs/promises';
import { parseCsv } from './parse-csv.js';

export async function parseCsvFile(filePath) {
  const content = await readFile(filePath, 'utf-8');
  return parseCsv(content);
}
