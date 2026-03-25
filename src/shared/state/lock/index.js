// -------- Lock File --------
import { unlink } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import logger from '../../utils/logger.js';
import { readLock } from './helpers/read-lock.js';
import { doAcquire } from './helpers/do-acquire.js';

export { createLockFile };
export { LockFile } from './helpers/class-wrapper.js';

// -------- Factory Function --------
function createLockFile(lockPath) {
  let acquired = false;

  async function forceRelease() {
    try { await unlink(lockPath); logger.debug(`Lock force-released: ${lockPath}`); }
    catch (error) { if (error.code !== 'ENOENT') logger.debug(`Could not force-release lock: ${error.message}`); }
    acquired = false;
  }

  function writeLockData() {
    const lockData = { pid: process.pid, hostname: hostname(), startedAt: new Date().toISOString(), version: 1 };
    writeFileSync(lockPath, JSON.stringify(lockData, null, 2), { flag: 'wx', encoding: 'utf-8' });
  }

  return {
    get lockPath() { return lockPath; },
    get acquired() { return acquired; },
    async acquire(forceUnlock = false) { return doAcquire(lockPath, writeLockData, forceRelease, forceUnlock, v => { acquired = v; }); },
    async release() {
      if (!acquired) return;
      try {
        const existing = await readLock(lockPath);
        if (existing && existing.pid === process.pid) { await unlink(lockPath); logger.debug(`Lock released: ${lockPath}`); }
      } catch (error) {
        if (error.code === 'ENOENT') return;
        logger.debug(`Could not release lock: ${error.message}`);
      }
      acquired = false;
    },
    forceRelease,
  };
}
