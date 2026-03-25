// -------- Apply Migrate Options --------

import logger from '../../../shared/utils/logger.js';
import { VALID_ONLY_COMPONENTS } from './valid-only-components.js';

export function applyMigrateOptions(migrateConfig, transferConfig, options) {
  if (options.dryRun) migrateConfig.dryRun = true;
  if (options.forceRestart) migrateConfig.forceRestart = true;
  if (options.skipIssueMetadataSync) migrateConfig.skipIssueMetadataSync = true;
  if (options.skipHotspotMetadataSync) migrateConfig.skipHotspotMetadataSync = true;
  if (options.skipQualityProfileSync) migrateConfig.skipQualityProfileSync = true;
  if (options.skipAllBranchSync) transferConfig.syncAllBranches = false;

  if (options.only) {
    const onlyComponents = options.only.split(',').map(s => s.trim()).filter(Boolean);
    const invalid = onlyComponents.filter(c => !VALID_ONLY_COMPONENTS.includes(c));
    if (invalid.length > 0) {
      logger.error(`Invalid --only component(s): ${invalid.join(', ')}`);
      logger.error(`Valid components: ${VALID_ONLY_COMPONENTS.join(', ')}`);
      process.exit(1);
    }
    if (onlyComponents.length === 0) {
      logger.error('--only requires at least one component');
      process.exit(1);
    }
    migrateConfig.onlyComponents = onlyComponents;
    logger.info(`Selective migration: only migrating [${onlyComponents.join(', ')}]`);
  }
}
