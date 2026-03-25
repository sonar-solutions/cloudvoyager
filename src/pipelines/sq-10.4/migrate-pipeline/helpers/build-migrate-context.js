import { resolvePerformanceConfig, collectEnvironmentInfo } from '../../../../shared/utils/concurrency.js';
import { createEmptyResults } from '../../pipeline/results.js';

// -------- Main Logic --------

/**
 * Build the migration context (results, perfConfig, ctx) from options.
 */
export function buildMigrateContext(options) {
  const { sonarqubeConfig, sonarcloudOrgs, enterpriseConfig, transferConfig = { mode: 'full', batchSize: 100 }, rateLimitConfig, performanceConfig: rawPerfConfig = {}, wait = false } = options;
  const migrateConfig = options.migrateConfig || {};
  const perfConfig = resolvePerformanceConfig(rawPerfConfig);
  const outputDir = migrateConfig.outputDir || './migration-output';

  const results = createEmptyResults();
  results.environment = collectEnvironmentInfo();
  results.configuration = {
    transferMode: transferConfig.mode || 'full', batchSize: transferConfig.batchSize || 100,
    autoTune: perfConfig.autoTune || false,
    performance: {
      maxConcurrency: perfConfig.maxConcurrency,
      sourceExtraction: { concurrency: perfConfig.sourceExtraction.concurrency },
      hotspotExtraction: { concurrency: perfConfig.hotspotExtraction.concurrency },
      issueSync: { concurrency: perfConfig.issueSync.concurrency },
      hotspotSync: { concurrency: perfConfig.hotspotSync.concurrency },
      projectMigration: { concurrency: perfConfig.projectMigration.concurrency },
    },
    rateLimit: rateLimitConfig ? { maxRetries: rateLimitConfig.maxRetries ?? 3, baseDelay: rateLimitConfig.baseDelay ?? 1000, minRequestInterval: rateLimitConfig.minRequestInterval ?? 0 } : { maxRetries: 3, baseDelay: 1000, minRequestInterval: 0 },
  };

  const ctx = {
    sonarqubeConfig, sonarcloudOrgs, enterpriseConfig, transferConfig, rateLimitConfig,
    perfConfig, outputDir, dryRun: migrateConfig.dryRun || false,
    skipIssueSync: migrateConfig.skipIssueMetadataSync || migrateConfig.skipIssueSync || false,
    skipHotspotSync: migrateConfig.skipHotspotMetadataSync || migrateConfig.skipHotspotSync || false,
    skipQualityProfileSync: migrateConfig.skipQualityProfileSync || false,
    skipProjectConfig: migrateConfig.skipProjectConfig || false,
    wait, onlyComponents: migrateConfig.onlyComponents || null,
    projectBranchIncludes: new Map(), migrationJournal: null,
  };

  return { results, perfConfig, ctx, outputDir, migrateConfig };
}
