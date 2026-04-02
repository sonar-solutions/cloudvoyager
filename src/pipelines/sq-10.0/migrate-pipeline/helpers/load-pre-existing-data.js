import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import logger from '../../../../shared/utils/logger.js';
import { loadMappingCsvs } from '../../../../shared/mapping/csv-reader.js';

// -------- Load Pre-Existing Data --------

export async function loadPreExistingCsvs(mappingsDir, dryRun) {
  if (dryRun || !existsSync(mappingsDir)) return null;
  try {
    const csvs = await loadMappingCsvs(mappingsDir);
    if (csvs.size > 0) {
      logger.info(`Found ${csvs.size} existing mapping CSV(s) from a previous dry-run`);
      logger.info('These will be used as the source of truth for filtering/overrides');
      return csvs;
    }
    return null;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    logger.error(`Failed to read existing CSV mappings: ${e.message}`);
    logger.error(`Fix or remove the CSV files in '${mappingsDir}' before continuing, or use --force-restart to discard them.`);
    throw e;
  }
}

export async function loadCachedServerData(cacheFile, dryRun) {
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
