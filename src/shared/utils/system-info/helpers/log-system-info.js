// -------- Log System Info --------
import { availableParallelism as _availableParallelism, cpus, totalmem } from 'node:os';
import logger from '../../logger.js';
import { getMemoryInfo } from './get-memory-info.js';
import { logAutoTuneDetails } from './log-auto-tune-details.js';

const availableParallelism = typeof _availableParallelism === 'function'
  ? _availableParallelism : () => cpus().length;

export function logSystemInfo(perfConfig) {
  const cpuCount = availableParallelism();
  const totalMemMB = Math.round(totalmem() / 1024 / 1024);
  const memInfo = getMemoryInfo();
  logger.info(`System: ${cpuCount} CPU cores, ${totalMemMB}MB total RAM, ${memInfo.heapSizeLimitMB}MB heap limit`);

  const concurrencyInfo = [
    `sources=${perfConfig.sourceExtraction.concurrency}`,
    `hotspots=${perfConfig.hotspotExtraction.concurrency}`,
    `issueSync=${perfConfig.issueSync.concurrency}`,
    `hotspotSync=${perfConfig.hotspotSync.concurrency}`,
    `projects=${perfConfig.projectMigration.concurrency}`
  ].join(', ');
  const tuneLabel = perfConfig.autoTune ? 'Performance (auto-tuned)' : 'Performance';
  logger.info(`${tuneLabel}: concurrency=[${concurrencyInfo}]`);

  if (perfConfig.autoTune) logAutoTuneDetails(perfConfig, cpuCount, totalMemMB, memInfo);
}
