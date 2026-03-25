import { resolvePerformanceConfig } from '../../../../shared/utils/concurrency.js';

// -------- Parse Migration Options --------

export function parseMigrateOpts(options) {
  const {
    sonarqubeConfig, sonarcloudOrgs, enterpriseConfig,
    migrateConfig = {}, transferConfig = { mode: 'full', batchSize: 100 },
    rateLimitConfig, performanceConfig: rawPerfConfig = {}, wait = false,
  } = options;
  const perfConfig = resolvePerformanceConfig(rawPerfConfig);
  const outputDir = migrateConfig.outputDir || './migration-output';
  return {
    sonarqubeConfig, sonarcloudOrgs, enterpriseConfig, transferConfig,
    rateLimitConfig, perfConfig, outputDir, wait,
    dryRun: migrateConfig.dryRun || false,
    skipIssueSync: migrateConfig.skipIssueMetadataSync || migrateConfig.skipIssueSync || false,
    skipHotspotSync: migrateConfig.skipHotspotMetadataSync || migrateConfig.skipHotspotSync || false,
    skipQualityProfileSync: migrateConfig.skipQualityProfileSync || false,
    skipProjectConfig: migrateConfig.skipProjectConfig || false,
    onlyComponents: migrateConfig.onlyComponents || null,
    forceRestart: migrateConfig.forceRestart || false,
  };
}
