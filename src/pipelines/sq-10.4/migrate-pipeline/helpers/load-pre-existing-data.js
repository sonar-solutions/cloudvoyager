import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { loadMappingCsvs } from '../../../../shared/mapping/csv-reader.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Load pre-existing CSV mappings and cached server data from a previous run.
 */
export async function loadPreExistingData(outputDir, dryRun) {
  const mappingsDir = join(outputDir, 'mappings');
  let preExistingCsvs = null;

  if (!dryRun && existsSync(mappingsDir)) {
    try {
      preExistingCsvs = await loadMappingCsvs(mappingsDir);
      if (preExistingCsvs.size > 0) {
        logger.info(`Found ${preExistingCsvs.size} existing mapping CSV(s) from a previous dry-run`);
      } else { preExistingCsvs = null; }
    } catch (e) {
      if (e.code !== 'ENOENT') {
        logger.error(`Failed to read existing CSV mappings: ${e.message}`);
        logger.error(`Fix or remove the CSV files in '${mappingsDir}' before continuing.`);
        throw e;
      }
    }
  }

  let cachedServerData = null;
  const cacheFile = join(outputDir, 'cache', 'server-wide-data.json');
  if (!dryRun && existsSync(cacheFile)) {
    try {
      const raw = JSON.parse(await readFile(cacheFile, 'utf-8'));
      raw.extractedData.projectBindings = new Map(raw.extractedData.projectBindings);
      raw.extractedData.projectBranches = new Map(raw.extractedData.projectBranches || []);
      cachedServerData = raw;
      logger.info('Found cached server-wide data from a previous run');
    } catch (e) { logger.warn(`Failed to read server-wide data cache: ${e.message}. Will re-extract.`); }
  }

  return { preExistingCsvs, cachedServerData };
}
