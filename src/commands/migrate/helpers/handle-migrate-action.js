// -------- Handle Migrate Action --------

import { loadMigrateConfig } from '../../../shared/config/loader.js';
import { detectAndRoute } from '../../../version-router.js';
import { logSystemInfo, ensureHeapSize } from '../../../shared/utils/concurrency.js';
import logger from '../../../shared/utils/logger.js';
import { applyMigrateOptions } from './apply-migrate-options.js';
import { buildMigratePerfConfig } from './build-migrate-perf-config.js';

export async function handleMigrateAction(options, shutdownCoordinator) {
  const config = await loadMigrateConfig(options.config);
  const migrateConfig = config.migrate || {};
  const transferConfig = config.transfer || { mode: 'full', batchSize: 100 };

  applyMigrateOptions(migrateConfig, transferConfig, options);

  const perfConfig = buildMigratePerfConfig(config, options);
  ensureHeapSize(perfConfig.maxMemoryMB);
  logSystemInfo(perfConfig);

  const { migrateAll, pipelineId } = await detectAndRoute(config.sonarqube);
  logger.info(`Using pipeline: ${pipelineId}`);

  const results = await migrateAll({
    sonarqubeConfig: config.sonarqube,
    sonarcloudOrgs: config.sonarcloud.organizations,
    enterpriseConfig: config.sonarcloud.enterprise,
    migrateConfig,
    transferConfig,
    rateLimitConfig: config.rateLimit,
    performanceConfig: perfConfig,
    wait: options.wait || false,
    shutdownCoordinator
  });

  const partial = results.projects.filter(p => p.status === 'partial').length;
  const failed = results.projects.filter(p => p.status === 'failed').length;
  if (failed > 0 || partial > 0) {
    logger.error(`${failed} project(s) failed, ${partial} project(s) partially migrated -- see migration report for details`);
    process.exit(1);
  }
}
