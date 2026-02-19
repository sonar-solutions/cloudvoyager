import logger from './logger.js';
export { resolvePerformanceConfig, ensureHeapSize, getMemoryInfo, logSystemInfo } from './system-info.js';

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
  if (settled) return Promise.all(promises);
  const results = await Promise.all(promises);
  return results.map(r => r.value);
}

export function createProgressLogger(label, total) {
  const interval = Math.max(10, Math.floor(total / 10));
  return (completed, _total) => {
    if (completed % interval === 0 || completed === total) {
      logger.info(`${label}: ${completed}/${total} (${Math.round(completed / total * 100)}%)`);
    }
  };
}
