import { resolvePerformanceConfig, collectEnvironmentInfo } from '../../../../shared/utils/concurrency.js';
import { createEmptyResults } from '../../pipeline/results.js';

// -------- Build Migration Context --------

/** Build the results, perfConfig, and context objects for the migration run. */
export function buildMigrationContext(options, migrationJournal) {
  const { sonarqubeConfig, sonarcloudOrgs, enterpriseConfig, rateLimitConfig } = options;
  const migrateConfig = options.migrateConfig || {};
  const transferConfig = options.transferConfig || { mode: 'full', batchSize: 100 };
  const perfConfig = resolvePerformanceConfig(options.performanceConfig || {});
  const outputDir = migrateConfig.outputDir || './migration-output';
  const dryRun = migrateConfig.dryRun || false;

  const results = createEmptyResults();
  results.environment = collectEnvironmentInfo();
  results.configuration = {
    transferMode: transferConfig.mode || 'full',
    batchSize: transferConfig.batchSize || 100,
    autoTune: perfConfig.autoTune || false,
    performance: {
      maxConcurrency: perfConfig.maxConcurrency,
      sourceExtraction: { concurrency: perfConfig.sourceExtraction.concurrency },
      hotspotExtraction: { concurrency: perfConfig.hotspotExtraction.concurrency },
      issueSync: { concurrency: perfConfig.issueSync.concurrency },
      hotspotSync: { concurrency: perfConfig.hotspotSync.concurrency },
      projectMigration: { concurrency: perfConfig.projectMigration.concurrency },
    },
    rateLimit: rateLimitConfig
      ? { maxRetries: rateLimitConfig.maxRetries ?? 3, baseDelay: rateLimitConfig.baseDelay ?? 1000, minRequestInterval: rateLimitConfig.minRequestInterval ?? 0 }
      : { maxRetries: 3, baseDelay: 1000, minRequestInterval: 0 },
  };

  const ctx = {
    sonarqubeConfig, sonarcloudOrgs, enterpriseConfig, transferConfig, rateLimitConfig,
    perfConfig, outputDir, dryRun,
    skipIssueSync: migrateConfig.skipIssueMetadataSync || migrateConfig.skipIssueSync || false,
    skipHotspotSync: migrateConfig.skipHotspotMetadataSync || migrateConfig.skipHotspotSync || false,
    skipQualityProfileSync: migrateConfig.skipQualityProfileSync || false,
    skipProjectConfig: migrateConfig.skipProjectConfig || false,
    wait: options.wait || false,
    onlyComponents: migrateConfig.onlyComponents || null,
    projectBranchIncludes: new Map(),
    migrationJournal: dryRun ? null : migrationJournal,
  };

  return { results, perfConfig, ctx, outputDir, dryRun };
}
