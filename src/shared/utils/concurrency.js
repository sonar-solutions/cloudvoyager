import logger from './logger.js';
export { resolvePerformanceConfig, ensureHeapSize, getMemoryInfo, logSystemInfo, collectEnvironmentInfo } from './system-info.js';

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

export async function mapConcurrent(items, fn, { concurrency = 8, settled = false, onProgress = null } = {}) {
  if (items.length === 0) return [];
  const results = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;

  // Worker-pool pattern: each worker pulls the next item as soon as it finishes,
  // so only `concurrency` items are ever in-flight simultaneously and the queue
  // never grows beyond the number of active workers regardless of input size.
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      try {
        const result = await fn(items[index], index);
        completed++;
        if (onProgress) onProgress(completed, items.length);
        results[index] = settled ? { status: 'fulfilled', value: result } : result;
      } catch (error) {
        completed++;
        if (onProgress) onProgress(completed, items.length);
        if (!settled) throw error;
        results[index] = { status: 'rejected', reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export function createProgressLogger(label, total) {
  // Log every ~2% or every 25 items, whichever is smaller (minimum every 10)
  const interval = Math.max(10, Math.min(25, Math.floor(total / 50)));
  return (completed, _total) => {
    if (completed % interval === 0 || completed === total) {
      logger.info(`${label}: ${completed}/${total} (${Math.round(completed / total * 100)}%)`);
    }
  };
}
