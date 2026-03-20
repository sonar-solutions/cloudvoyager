import { readFile, unlink } from 'node:fs/promises';
import { writeFileSync } from 'node:fs'; // writeFileSync with 'wx' flag for atomic lock creation
import { hostname } from 'node:os';
import logger from '../utils/logger.js';
import { LockError } from '../utils/errors.js';

const STALE_LOCK_HOURS = 6;

/**
 * Advisory lock file to prevent concurrent runs on the same state file.
 */
export class LockFile {
  constructor(lockPath) {
    this.lockPath = lockPath;
    this.acquired = false;
  }

  /**
   * Acquire the lock. Fails if already held by another live process.
   * @param {boolean} forceUnlock - Force release of stale/foreign locks
   */
  async acquire(forceUnlock = false) {
    const lockData = {
      pid: process.pid,
      hostname: hostname(),
      startedAt: new Date().toISOString(),
      version: 1,
    };

    // Attempt atomic create-or-fail using O_CREAT|O_EXCL to eliminate TOCTOU race
    try {
      writeFileSync(this.lockPath, JSON.stringify(lockData, null, 2), { flag: 'wx', encoding: 'utf-8' });
      // Successfully created — we hold the lock
      this.acquired = true;
      logger.debug(`Lock acquired: ${this.lockPath}`);
      return;
    } catch (err) {
      if (err.code !== 'EEXIST') throw err;
      // Lock file already exists — fall through to check staleness
    }

    // Lock file exists — read and evaluate
    const existing = await this._readLock();

    if (existing) {
      if (existing.pid === process.pid) {
        // Re-entrant: same process already holds lock
        this.acquired = true;
        return;
      }

      const stale = this._isStale(existing);
      if (stale) {
        logger.warn(
          `Found stale lock from PID ${existing.pid} (started ${existing.startedAt}). Auto-releasing.`
        );
        await this.forceRelease();
      } else if (forceUnlock) {
        logger.warn(`Force-releasing lock held by PID ${existing.pid} on ${existing.hostname}`);
        await this.forceRelease();
      } else if (existing.hostname !== hostname()) {
        throw new LockError(
          `Lock held by another host (${existing.hostname}, PID ${existing.pid}). ` +
          `Use --force-unlock to override, or manually delete: ${this.lockPath}`
        );
      } else {
        throw new LockError(
          `Another instance is running (PID ${existing.pid}, started ${existing.startedAt}). ` +
          `If this is incorrect, delete ${this.lockPath} or use --force-unlock`
        );
      }
    } else {
      // Corrupt lock file — treat as stale
      logger.warn('Found corrupt lock file, overwriting');
    }

    // Write our lock data after releasing stale/corrupt lock
    try {
      writeFileSync(this.lockPath, JSON.stringify(lockData, null, 2), { flag: 'wx', encoding: 'utf-8' });
    } catch (err) {
      if (err.code === 'EEXIST') {
        // Another process grabbed the lock between our forceRelease and write — fail
        throw new LockError(
          `Failed to acquire lock — another process grabbed it. Retry or use --force-unlock`
        );
      }
      throw err;
    }

    this.acquired = true;
    logger.debug(`Lock acquired: ${this.lockPath}`);
  }

  /**
   * Release the lock (only if we hold it).
   */
  async release() {
    if (!this.acquired) return;

    try {
      // Read first to verify ownership, then unlink atomically.
      // Skipping existsSync avoids the TOCTOU race where the file could be
      // deleted between the check and the unlink.
      const existing = await this._readLock();
      if (existing && existing.pid === process.pid) {
        await unlink(this.lockPath);
        logger.debug(`Lock released: ${this.lockPath}`);
      }
    } catch (error) {
      if (error.code === 'ENOENT') return; // already gone — that's fine
      logger.debug(`Could not release lock: ${error.message}`);
    }
    this.acquired = false;
  }

  /**
   * Force release the lock regardless of owner.
   */
  async forceRelease() {
    try {
      await unlink(this.lockPath);
      logger.debug(`Lock force-released: ${this.lockPath}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.debug(`Could not force-release lock: ${error.message}`);
      }
    }
    this.acquired = false;
  }

  /**
   * Check if the lock is stale (PID dead or too old).
   * @param {object} lockData - Parsed lock file data
   * @returns {boolean}
   */
  _isStale(lockData) {
    // Check if PID is alive (same host only)
    if (lockData.hostname === hostname()) {
      try {
        process.kill(lockData.pid, 0); // signal 0 = existence check
        // PID is alive — not stale
      } catch {
        // PID is dead — stale
        return true;
      }
    }

    // Check age
    const lockAge = Date.now() - new Date(lockData.startedAt).getTime();
    if (Number.isNaN(lockAge)) return true; // Treat unparseable timestamp as stale
    const maxAge = STALE_LOCK_HOURS * 60 * 60 * 1000;
    return lockAge > maxAge;
  }

  /**
   * Read and parse the lock file.
   * @returns {Promise<object|null>}
   */
  async _readLock() {
    try {
      const content = await readFile(this.lockPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
