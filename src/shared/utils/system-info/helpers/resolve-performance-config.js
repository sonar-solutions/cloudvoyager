// -------- Resolve Performance Config --------
import { getAutoTuneDefaults } from './get-auto-tune-defaults.js';

export function resolvePerformanceConfig(perfConfig = {}) {
  const defaults = perfConfig.autoTune ? getAutoTuneDefaults() : {
    maxConcurrency: 64, maxMemoryMB: 8192,
    sourceExtraction: { concurrency: 50 }, hotspotExtraction: { concurrency: 50 },
    issueSync: { concurrency: 20 }, hotspotSync: { concurrency: 20 },
    projectMigration: { concurrency: 8 }
  };
  return {
    autoTune: perfConfig.autoTune || false,
    maxConcurrency: perfConfig.maxConcurrency || defaults.maxConcurrency,
    maxMemoryMB: perfConfig.maxMemoryMB || defaults.maxMemoryMB,
    sourceExtraction: { concurrency: perfConfig.sourceExtraction?.concurrency || defaults.sourceExtraction.concurrency },
    hotspotExtraction: { concurrency: perfConfig.hotspotExtraction?.concurrency || defaults.hotspotExtraction.concurrency },
    issueSync: { concurrency: perfConfig.issueSync?.concurrency || defaults.issueSync.concurrency },
    hotspotSync: { concurrency: perfConfig.hotspotSync?.concurrency || defaults.hotspotSync.concurrency },
    projectMigration: { concurrency: perfConfig.projectMigration?.concurrency || defaults.projectMigration.concurrency }
  };
}
