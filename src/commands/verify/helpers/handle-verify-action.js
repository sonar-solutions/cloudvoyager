// -------- Handle Verify Action --------

import { loadMigrateConfig } from '../../../shared/config/loader.js';
import { verifyAll } from '../../../shared/verification/verify-pipeline.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../../../shared/utils/concurrency.js';
import logger from '../../../shared/utils/logger.js';
import { parseOnlyComponents } from './parse-only-components.js';

export async function handleVerifyAction(options) {
  const config = await loadMigrateConfig(options.config);
  const onlyComponents = parseOnlyComponents(options);

  const perfConfig = resolvePerformanceConfig({
    ...config.performance,
    ...(options.autoTune && { autoTune: true }),
    ...(options.concurrency && {
      maxConcurrency: options.concurrency,
      issueSync: { concurrency: options.concurrency },
      hotspotSync: { concurrency: Math.min(options.concurrency, 3) }
    }),
    ...(options.maxMemory && { maxMemoryMB: options.maxMemory })
  });
  ensureHeapSize(perfConfig.maxMemoryMB);
  logSystemInfo(perfConfig);

  const results = await verifyAll({
    sonarqubeConfig: config.sonarqube,
    sonarcloudOrgs: config.sonarcloud.organizations,
    rateLimitConfig: config.rateLimit,
    performanceConfig: perfConfig,
    outputDir: options.outputDir,
    onlyComponents
  });

  if (results.summary.failed > 0 || results.summary.errors > 0) {
    logger.error(`Verification completed with ${results.summary.failed} failures and ${results.summary.errors} errors`);
    process.exit(1);
  }
}
