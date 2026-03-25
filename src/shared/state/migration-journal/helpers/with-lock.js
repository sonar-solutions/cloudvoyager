// -------- Write Lock Helper --------

/**
 * Serialize write operations to prevent concurrent read-modify-write races.
 * Returns a function that wraps async operations with sequential locking.
 */
export function createWriteLock() {
  let writeLock = Promise.resolve();

  return async function withLock(fn) {
    let release;
    const acquired = new Promise(resolve => { release = resolve; });
    const prev = writeLock;
    writeLock = acquired;
    await prev;
    try { return await fn(); } finally { release(); }
  };
}
