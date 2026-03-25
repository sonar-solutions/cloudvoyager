// -------- Handle Sync Metadata Action --------

import { loadMigrateConfig } from '../../../shared/config/loader.js';
import { detectAndRoute } from '../../../version-router.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../../../shared/utils/concurrency.js';
import logger from '../../../shared/utils/logger.js';

export async function handleSyncMetadataAction(options) {
  const config = await loadMigrateConfig(options.config);
  const migrateConfig = config.migrate || {};
  if (options.skipIssueMetadataSync) migrateConfig.skipIssueMetadataSync = true;
  if (options.skipHotspotMetadataSync) migrateConfig.skipHotspotMetadataSync = true;
  if (options.skipQualityProfileSync) migrateConfig.skipQualityProfileSync = true;

  const transferConfig = config.transfer || { mode: 'full', batchSize: 100 };
  if (options.skipAllBranchSync) transferConfig.syncAllBranches = false;

  const perfConfig = resolvePerformanceConfig({
    ...config.performance,
    ...(options.autoTune && { autoTune: true }),
    ...(options.concurrency && { issueSync: { concurrency: options.concurrency }, hotspotSync: { concurrency: Math.min(options.concurrency, 3) }, hotspotExtraction: { concurrency: options.concurrency } }),
    ...(options.maxMemory && { maxMemoryMB: options.maxMemory })
  });
  ensureHeapSize(perfConfig.maxMemoryMB);
  logSystemInfo(perfConfig);

  migrateConfig.dryRun = false;
  migrateConfig.skipProjectConfig = true;
  const { migrateAll, pipelineId } = await detectAndRoute(config.sonarqube);
  logger.info(`Using pipeline: ${pipelineId}`);

  const results = await migrateAll({
    sonarqubeConfig: config.sonarqube,
    sonarcloudOrgs: config.sonarcloud.organizations,
    enterpriseConfig: config.sonarcloud.enterprise,
    migrateConfig,
    transferConfig,
    rateLimitConfig: config.rateLimit,
    performanceConfig: perfConfig
  });

  const failed = results.projects.filter(p => p.status === 'failed').length;
  if (failed > 0) {
    logger.error(`${failed} project(s) failed metadata sync`);
    process.exit(1);
  }
}
