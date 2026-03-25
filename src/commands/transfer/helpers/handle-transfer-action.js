// -------- Handle Transfer Action --------

import { loadConfig, requireProjectKeys } from '../../../shared/config/loader.js';
import { detectAndRoute } from '../../../version-router.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../../../shared/utils/concurrency.js';
import { ProgressTracker } from '../../../shared/utils/progress.js';
import logger from '../../../shared/utils/logger.js';

export async function handleTransferAction(options, shutdownCoordinator) {
  const config = await loadConfig(options.config);
  requireProjectKeys(config);

  if (options.showProgress) {
    const stateFile = config.transfer?.stateFile || './.cloudvoyager-state.json';
    const progressTracker = new ProgressTracker(stateFile);
    await progressTracker.displayStatus();
    return;
  }

  logger.info('=== CloudVoyager Migration ===');
  logger.info('Starting data transfer from SonarQube to SonarCloud...');

  const transferConfig = config.transfer || {};
  if (options.skipAllBranchSync) transferConfig.syncAllBranches = false;

  const perfConfig = resolvePerformanceConfig({
    ...config.performance,
    ...(options.autoTune && { autoTune: true }),
    ...(options.concurrency && { maxConcurrency: options.concurrency, sourceExtraction: { concurrency: options.concurrency }, hotspotExtraction: { concurrency: options.concurrency } }),
    ...(options.maxMemory && { maxMemoryMB: options.maxMemory }),
  });
  ensureHeapSize(perfConfig.maxMemoryMB);
  logSystemInfo(perfConfig);

  const { transferProject, pipelineId } = await detectAndRoute(config.sonarqube);
  logger.info(`Using pipeline: ${pipelineId}`);

  await transferProject({
    sonarqubeConfig: config.sonarqube,
    sonarcloudConfig: config.sonarcloud,
    transferConfig,
    performanceConfig: perfConfig,
    wait: options.wait || false,
    shutdownCoordinator,
    forceRestart: options.forceRestart || false,
    forceFreshExtract: options.forceFreshExtract || false,
    forceUnlock: options.forceUnlock || false
  });
}
