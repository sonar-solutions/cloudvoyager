// -------- Check Lock Staleness --------

import { hostname } from 'node:os';

const STALE_LOCK_HOURS = 6;

/**
 * Check if the lock is stale (PID dead or too old).
 * @param {object} lockData - Parsed lock file data
 * @returns {boolean}
 */
export function isStale(lockData) {
  // Check if PID is alive (same host only)
  if (lockData.hostname === hostname()) {
    try {
      process.kill(lockData.pid, 0);
    } catch {
      return true;
    }
  }

  // Check age
  const lockAge = Date.now() - new Date(lockData.startedAt).getTime();
  if (Number.isNaN(lockAge)) return true;
  const maxAge = STALE_LOCK_HOURS * 60 * 60 * 1000;
  return lockAge > maxAge;
}
