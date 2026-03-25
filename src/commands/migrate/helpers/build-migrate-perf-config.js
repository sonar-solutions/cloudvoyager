// -------- Build Migrate Perf Config --------

import { resolvePerformanceConfig } from '../../../shared/utils/concurrency.js';

export function buildMigratePerfConfig(config, options) {
  return resolvePerformanceConfig({
    ...config.performance,
    ...(options.autoTune && { autoTune: true }),
    ...(options.concurrency && { maxConcurrency: options.concurrency, sourceExtraction: { concurrency: options.concurrency }, hotspotExtraction: { concurrency: options.concurrency }, issueSync: { concurrency: options.concurrency }, hotspotSync: { concurrency: Math.min(options.concurrency, 3) } }),
    ...(options.maxMemory && { maxMemoryMB: options.maxMemory }),
    ...(options.projectConcurrency && { projectMigration: { concurrency: options.projectConcurrency } })
  });
}
