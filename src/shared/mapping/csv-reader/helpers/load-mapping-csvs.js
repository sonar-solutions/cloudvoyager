// -------- Load All Mapping CSVs --------
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../utils/logger.js';
import { parseCsvFile } from './parse-csv-file.js';

export async function loadMappingCsvs(mappingsDir) {
  const csvMap = new Map();
  let entries;
  try { entries = await readdir(mappingsDir); }
  catch { return csvMap; }

  const csvFiles = entries.filter(f => f.endsWith('.csv'));
  for (const fileName of csvFiles) {
    try {
      const parsed = await parseCsvFile(join(mappingsDir, fileName));
      if (parsed.headers.length > 0 && parsed.rows.length > 0) {
        csvMap.set(fileName, parsed);
        logger.debug(`Loaded CSV: ${fileName} (${parsed.rows.length} rows)`);
      }
    } catch (error) {
      logger.warn(`Failed to parse ${fileName}: ${error.message}`);
    }
  }
  return csvMap;
}
