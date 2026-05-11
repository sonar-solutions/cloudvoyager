// -------- Map Concurrent --------
export async function mapConcurrent(items, fn, { concurrency = 8, settled = false, onProgress = null } = {}) {
  if (items.length === 0) return [];
  const results = new Array(items.length);
  let nextIndex = 0;
  let completed = 0;
  let aborted = false;

  function claimIndex() {
    if (nextIndex >= items.length) return -1;
    return nextIndex++;
  }

  async function worker() {
    while (!aborted) {
      const index = claimIndex();
      if (index === -1) break;
      try {
        const result = await fn(items[index], index);
        completed++;
        if (onProgress) onProgress(completed, items.length);
        results[index] = settled ? { status: 'fulfilled', value: result } : result;
      } catch (error) {
        completed++;
        if (onProgress) onProgress(completed, items.length);
        if (!settled) { aborted = true; throw error; }
        results[index] = { status: 'rejected', reason: error };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
