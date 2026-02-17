import { availableParallelism as _availableParallelism, cpus, totalmem } from 'node:os';

// availableParallelism() was added in Node 18.14.0; pkg bundles an older 18.x runtime
// that lacks it, so fall back to cpus().length.
const availableParallelism = typeof _availableParallelism === 'function'
  ? _availableParallelism
  : () => cpus().length;
import { spawnSync } from 'node:child_process';
import v8 from 'node:v8';
import logger from './logger.js';

/**
 * Create a concurrency limiter (equivalent to p-limit).
 * Implemented inline to avoid adding p-limit as an ESM-only dependency.
 *
 * @param {number} concurrency - Max concurrent operations
 * @returns {function} Limiter function: limiter(fn) => Promise
 */
export function createLimiter(concurrency) {
  let active = 0;
  const queue = [];

  const next = () => {
    while (queue.length > 0 && active < concurrency) {
      active++;
      const { fn, resolve, reject } = queue.shift();
      fn().then(resolve, reject).finally(() => {
        active--;
        next();
      });
    }
  };

  return (fn) => new Promise((resolve, reject) => {
    queue.push({ fn, resolve, reject });
    next();
  });
}

/**
 * Map over an array with controlled concurrency.
 * Like Promise.all but with a concurrency limit.
 *
 * @param {Array} items - Items to process
 * @param {function} fn - Async function to apply to each item: (item, index) => Promise
 * @param {object} options
 * @param {number} options.concurrency - Max concurrent operations (default 8)
 * @param {boolean} options.settled - If true, use allSettled semantics (don't fail fast)
 * @param {function} [options.onProgress] - Progress callback: (completed, total) => void
 * @returns {Promise<Array>} Results in order. If settled=true, returns [{status, value/reason}].
 */
export async function mapConcurrent(items, fn, { concurrency = 8, settled = false, onProgress = null } = {}) {
  if (items.length === 0) return [];

  const limiter = createLimiter(concurrency);
  let completed = 0;

  const promises = items.map((item, index) =>
    limiter(async () => {
      try {
        const result = await fn(item, index);
        completed++;
        if (onProgress) onProgress(completed, items.length);
        return { status: 'fulfilled', value: result };
      } catch (error) {
        completed++;
        if (onProgress) onProgress(completed, items.length);
        if (!settled) throw error;
        return { status: 'rejected', reason: error };
      }
    })
  );

  if (settled) {
    return Promise.all(promises);
  }

  const results = await Promise.all(promises);
  return results.map(r => r.value);
}

/**
 * Compute hardware-aware performance defaults based on detected CPU and RAM.
 * Used when autoTune is enabled.
 *
 * @returns {object} Auto-tuned performance defaults
 */
function getAutoTuneDefaults() {
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

/**
 * Resolve performance configuration with defaults and CPU-aware scaling.
 * When autoTune is enabled, uses hardware-detected values as the base defaults.
 *
 * @param {object} perfConfig - Raw performance config from user
 * @returns {object} Resolved performance config with all defaults filled in
 */
export function resolvePerformanceConfig(perfConfig = {}) {
  const cpuCount = availableParallelism();

  const defaults = perfConfig.autoTune ? getAutoTuneDefaults() : {
    maxConcurrency: Math.min(cpuCount, 8),
    maxMemoryMB: 0,
    sourceExtraction: { concurrency: 10 },
    hotspotExtraction: { concurrency: 10 },
    issueSync: { concurrency: 5 },
    hotspotSync: { concurrency: 3 },
    projectMigration: { concurrency: 1 }
  };

  return {
    autoTune: perfConfig.autoTune || false,
    maxConcurrency: perfConfig.maxConcurrency || defaults.maxConcurrency,
    maxMemoryMB: perfConfig.maxMemoryMB || defaults.maxMemoryMB,
    sourceExtraction: {
      concurrency: perfConfig.sourceExtraction?.concurrency || defaults.sourceExtraction.concurrency
    },
    hotspotExtraction: {
      concurrency: perfConfig.hotspotExtraction?.concurrency || defaults.hotspotExtraction.concurrency
    },
    issueSync: {
      concurrency: perfConfig.issueSync?.concurrency || defaults.issueSync.concurrency
    },
    hotspotSync: {
      concurrency: perfConfig.hotspotSync?.concurrency || defaults.hotspotSync.concurrency
    },
    projectMigration: {
      concurrency: perfConfig.projectMigration?.concurrency || defaults.projectMigration.concurrency
    }
  };
}

/**
 * Create a progress logger for concurrent operations.
 * Logs at intervals based on total count.
 *
 * @param {string} label - Label for the operation
 * @param {number} total - Total items to process
 * @returns {function} Progress callback: (completed, total) => void
 */
export function createProgressLogger(label, total) {
  const interval = Math.max(10, Math.floor(total / 10));
  return (completed, _total) => {
    if (completed % interval === 0 || completed === total) {
      logger.info(`${label}: ${completed}/${total} (${Math.round(completed / total * 100)}%)`);
    }
  };
}

/**
 * Ensure the process is running with at least the requested heap size.
 * If the current heap limit is insufficient, re-spawns the process with
 * NODE_OPTIONS="--max-old-space-size=<value>" set automatically.
 *
 * Uses CLOUDVOYAGER_RESPAWNED env var to prevent infinite respawn loops.
 *
 * @param {number} maxMemoryMB - Desired heap size in MB (0 = no-op)
 */
export function ensureHeapSize(maxMemoryMB) {
  if (!maxMemoryMB || maxMemoryMB <= 0) return;
  if (process.env.CLOUDVOYAGER_RESPAWNED) return;

  const currentLimit = Math.round(v8.getHeapStatistics().heap_size_limit / 1024 / 1024);
  if (currentLimit >= maxMemoryMB) return;

  const existingNodeOptions = process.env.NODE_OPTIONS || '';
  const newNodeOptions = `${existingNodeOptions} --max-old-space-size=${maxMemoryMB}`.trim();

  logger.info(`Restarting with ${maxMemoryMB}MB heap (current: ${currentLimit}MB)...`);

  const result = spawnSync(process.execPath, process.argv.slice(1), {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: newNodeOptions, CLOUDVOYAGER_RESPAWNED: '1' }
  });

  process.exit(result.status ?? 1);
}

/**
 * Get current V8 heap statistics.
 * @returns {object} Heap statistics in MB
 */
export function getMemoryInfo() {
  const heapStats = v8.getHeapStatistics();
  return {
    heapSizeLimitMB: Math.round(heapStats.heap_size_limit / 1024 / 1024),
    usedHeapMB: Math.round(heapStats.used_heap_size / 1024 / 1024),
    totalHeapMB: Math.round(heapStats.total_heap_size / 1024 / 1024)
  };
}

/**
 * Log system and performance configuration info at startup.
 *
 * @param {object} perfConfig - Resolved performance config
 */
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
}
