// -------- Acquire Lock --------

import logger from '../../../utils/logger.js';
import { hostname } from 'node:os';
import { LockError } from '../../../utils/errors.js';
import { readLock } from './read-lock.js';
import { isStale } from './is-stale.js';

export async function doAcquire(lockPath, writeLockData, forceReleaseFn, forceUnlock, setAcquired) {
  try { writeLockData(); setAcquired(true); logger.debug(`Lock acquired: ${lockPath}`); return; }
  catch (err) { if (err.code !== 'EEXIST') throw err; }

  const existing = await readLock(lockPath);
  if (existing) {
    if (existing.pid === process.pid) { setAcquired(true); return; }
    if (isStale(existing)) { logger.warn(`Found stale lock from PID ${existing.pid} (started ${existing.startedAt}). Auto-releasing.`); await forceReleaseFn(); }
    else if (forceUnlock) { logger.warn(`Force-releasing lock held by PID ${existing.pid} on ${existing.hostname}`); await forceReleaseFn(); }
    else if (existing.hostname !== hostname()) { throw new LockError(`Lock held by another host (${existing.hostname}, PID ${existing.pid}). Use --force-unlock to override, or manually delete: ${lockPath}`); }
    else { throw new LockError(`Another instance is running (PID ${existing.pid}, started ${existing.startedAt}). If this is incorrect, delete ${lockPath} or use --force-unlock`); }
  } else {
    logger.warn('Found corrupt lock file, overwriting');
  }

  try { writeLockData(); } catch (err) {
    if (err.code === 'EEXIST') throw new LockError('Failed to acquire lock — another process grabbed it. Retry or use --force-unlock');
    throw err;
  }
  setAcquired(true);
  logger.debug(`Lock acquired: ${lockPath}`);
}
