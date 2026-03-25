import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';

// -------- Load Cached Server-Wide Data from a Previous Run --------

export async function loadCachedServerData(outputDir, dryRun) {
  const cacheFile = join(outputDir, 'cache', 'server-wide-data.json');
  if (dryRun || !existsSync(cacheFile)) return null;

  try {
    const raw = JSON.parse(await readFile(cacheFile, 'utf-8'));
    raw.extractedData.projectBindings = new Map(raw.extractedData.projectBindings);
    raw.extractedData.projectBranches = new Map(raw.extractedData.projectBranches || []);
    logger.info('Found cached server-wide data from a previous run — will reuse instead of re-extracting');
    return raw;
  } catch (e) {
    logger.warn(`Failed to read server-wide data cache: ${e.message}. Will re-extract.`);
    return null;
  }
}
