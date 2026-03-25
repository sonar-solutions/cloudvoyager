import logger from '../../../../shared/utils/logger.js';

// -------- Handle Dry-Run Output --------

export function handleDryRun(results, mappingsDir) {
  logger.info('');
  logger.info('=== Dry run complete ===');
  logger.info(`Mapping CSVs generated in: ${mappingsDir}`);
  logger.info('');
  logger.info('Review and edit the CSV files to customize your migration:');
  logger.info('  - Set Include=no on any row to exclude it from migration');
  logger.info('  - Edit quality gate condition thresholds (Condition Threshold column)');
  logger.info('  - Remove specific permission assignments');
  logger.info('  - Exclude specific portfolio project memberships');
  logger.info('  - Fill in SonarCloud Login in user-mappings.csv to map SQ users to SC users');
  logger.info('  - Set Include=no in user-mappings.csv to skip assignment for specific users');
  logger.info('');
  logger.info('When ready, re-run without --dry-run:');
  logger.info('  cloudvoyager migrate -c config.json');
  logger.info('');
  logger.info('The tool will automatically detect and apply your CSV edits.');
  results.dryRun = true;
  return results;
}
