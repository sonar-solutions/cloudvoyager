import { existsSync } from 'node:fs';
import { join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';
import { loadMappingCsvs } from '../../../../shared/mapping/csv-reader.js';

// -------- Load Mapping CSVs from a Previous Dry-Run --------

export async function loadPreExistingCsvs(outputDir, dryRun) {
  const mappingsDir = join(outputDir, 'mappings');
  if (dryRun || !existsSync(mappingsDir)) return null;

  try {
    const csvs = await loadMappingCsvs(mappingsDir);
    if (csvs.size === 0) return null;
    logger.info(`Found ${csvs.size} existing mapping CSV(s) from a previous dry-run`);
    logger.info('These will be used as the source of truth for filtering/overrides');
    return csvs;
  } catch (e) {
    if (e.code === 'ENOENT') return null;
    logger.error(`Failed to read existing CSV mappings: ${e.message}`);
    logger.error(`Fix or remove the CSV files in '${mappingsDir}' before continuing, or use --force-restart to discard them.`);
    throw e;
  }
}
