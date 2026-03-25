import { join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Handle dry-run completion: log CSV instructions and return results.
 */
export function handleDryRun(results, outputDir) {
  const mappingsDir = join(outputDir, 'mappings');
  logger.info('');
  logger.info('=== Dry run complete ===');
  logger.info(`Mapping CSVs generated in: ${mappingsDir}`);
  logger.info('');
  logger.info('Review and edit the CSV files to customize your migration:');
  logger.info('  - Set Include=no on any row to exclude it from migration');
  logger.info('  - Edit quality gate condition thresholds');
  logger.info('  - Remove specific permission assignments');
  logger.info('  - Fill in SonarCloud Login in user-mappings.csv');
  logger.info('  - Set Include=no in user-mappings.csv to skip assignment');
  logger.info('');
  logger.info('When ready, re-run without --dry-run:');
  logger.info('  cloudvoyager migrate -c config.json');
  logger.info('');
  results.dryRun = true;
  return results;
}
