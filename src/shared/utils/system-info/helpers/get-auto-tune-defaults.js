// -------- Auto-Tune Defaults --------
import { availableParallelism as _availableParallelism, cpus, totalmem } from 'node:os';

const availableParallelism = typeof _availableParallelism === 'function'
  ? _availableParallelism : () => cpus().length;

export function getAutoTuneDefaults() {
  const cpuCount = availableParallelism();
  const totalMemMB = Math.round(totalmem() / 1024 / 1024);
  const safeMemoryMB = Math.min(Math.round(totalMemMB * 0.75), 16384);
  return {
    maxConcurrency: cpuCount,
    maxMemoryMB: safeMemoryMB,
    sourceExtraction: { concurrency: cpuCount * 2 },
    hotspotExtraction: { concurrency: cpuCount * 2 },
    issueSync: { concurrency: cpuCount },
    hotspotSync: { concurrency: Math.min(Math.max(Math.floor(cpuCount / 2), 3), 5) },
    projectMigration: { concurrency: Math.max(1, Math.floor(cpuCount / 3)) }
  };
}
