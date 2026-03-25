import { resolvePerformanceConfig } from '../../../../shared/utils/concurrency.js';

// -------- Parse and Normalize Migration Options --------

export function parseOptions(options) {
  const {
    sonarqubeConfig, sonarcloudOrgs, enterpriseConfig,
    migrateConfig = {}, transferConfig = { mode: 'full', batchSize: 100 },
    rateLimitConfig, performanceConfig: rawPerfConfig = {}, wait = false
  } = options;

  const perfConfig = resolvePerformanceConfig(rawPerfConfig);
  const outputDir = migrateConfig.outputDir || './migration-output';
  const dryRun = migrateConfig.dryRun || false;

  return {
    sonarqubeConfig, sonarcloudOrgs, enterpriseConfig, transferConfig,
    rateLimitConfig, perfConfig, outputDir, dryRun, wait,
    skipIssueSync: migrateConfig.skipIssueMetadataSync || migrateConfig.skipIssueSync || false,
    skipHotspotSync: migrateConfig.skipHotspotMetadataSync || migrateConfig.skipHotspotSync || false,
    skipQualityProfileSync: migrateConfig.skipQualityProfileSync || false,
    skipProjectConfig: migrateConfig.skipProjectConfig || false,
    onlyComponents: migrateConfig.onlyComponents || null,
    forceRestart: migrateConfig.forceRestart || false,
  };
}
