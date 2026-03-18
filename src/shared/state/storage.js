import { readFile, unlink, rename, copyFile, open } from 'node:fs/promises';
import { existsSync, statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import logger from '../utils/logger.js';
import { StateError } from '../utils/errors.js';

const MIN_DISK_SPACE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Persistent state storage with atomic save and backup support
 */
export class StateStorage {
  constructor(stateFilePath) {
    this.filePath = stateFilePath;
  }

  /**
   * Load state from file with fallback to backup
   * @returns {Promise<object|null>} State object or null if doesn't exist
   */
  async load() {
    // Try main file first
    const mainState = await this._tryLoadFile(this.filePath);
    if (mainState !== null) return mainState;

    // Fallback to backup file
    const backupPath = `${this.filePath}.backup`;
    if (existsSync(backupPath)) {
      logger.warn(`Main state file missing or corrupt, falling back to backup: ${backupPath}`);
      const backupState = await this._tryLoadFile(backupPath);
      if (backupState !== null) {
        // Restore backup as main file
        try {
          await copyFile(backupPath, this.filePath);
          logger.info('Restored state from backup file');
        } catch { /* best effort */ }
        return backupState;
      }
      logger.warn('Backup state file is also corrupt');
    }

    logger.debug('No valid state file found');
    return null;
  }

  /**
   * Try to load and parse a JSON file
   * @param {string} filePath
   * @returns {Promise<object|null>}
   */
  async _tryLoadFile(filePath) {
    try {
      if (!existsSync(filePath)) return null;
      logger.debug(`Loading state from: ${filePath}`);
      const content = await readFile(filePath, 'utf-8');
      if (!content.trim()) return null;
      const state = JSON.parse(content);
      logger.info(`Loaded state from ${filePath}`);
      return state;
    } catch (error) {
      if (error instanceof SyntaxError) {
        logger.warn(`Invalid JSON in state file ${filePath}: ${error.message}`);
        return null;
      }
      if (error.code === 'ENOENT') return null;
      throw new StateError(`Failed to load state from ${filePath}: ${error.message}`);
    }
  }

  /**
   * Save state to file atomically (write-to-temp, fsync, rename)
   * @param {object} state - State object to save
   */
  async save(state) {
    try {
      logger.debug(`Saving state to: ${this.filePath}`);

      // Check disk space
      this._checkDiskSpace();

      // Atomic backup: rename current file to .backup before overwriting
      if (existsSync(this.filePath)) {
        try {
          await rename(this.filePath, `${this.filePath}.backup`);
        } catch (err) {
          logger.debug(`Could not create backup: ${err.message}`);
        }
      }

      // Atomic write: write to temp, fsync, rename
      const tmpPath = `${this.filePath}.tmp`;
      const content = JSON.stringify(state, null, 2);
      const fd = await open(tmpPath, 'w');
      try {
        await fd.writeFile(content, 'utf-8');
        await fd.sync();
      } finally {
        await fd.close();
      }
      await rename(tmpPath, this.filePath);

      logger.info(`Saved state to ${this.filePath}`);
    } catch (error) {
      if (error instanceof StateError) throw error;
      throw new StateError(`Failed to save state: ${error.message}`);
    }
  }

  /**
   * Check available disk space before writing
   * @throws {StateError} if insufficient disk space
   */
  _checkDiskSpace() {
    try {
      const dir = dirname(this.filePath);
      const stats = statfsSync(dir);
      const availableBytes = stats.bavail * stats.bsize;
      if (availableBytes < MIN_DISK_SPACE_BYTES) {
        throw new StateError(
          `Insufficient disk space: ${Math.round(availableBytes / 1024 / 1024)}MB available, need at least 10MB`
        );
      }
    } catch (error) {
      if (error instanceof StateError) throw error;
      // statfsSync may not be available on all platforms; proceed without check
      logger.debug(`Could not check disk space: ${error.message}`);
    }
  }

  /**
   * Clear state file and its backup/temp files
   */
  async clear() {
    const filesToClear = [
      this.filePath,
      `${this.filePath}.backup`,
      `${this.filePath}.tmp`,
    ];

    for (const file of filesToClear) {
      try {
        if (existsSync(file)) {
          await unlink(file);
          logger.debug(`Cleared: ${file}`);
        }
      } catch (error) {
        logger.debug(`Could not clear ${file}: ${error.message}`);
      }
    }

    logger.info('State file cleared');
  }

  /**
   * Check if state file exists
   * @returns {boolean}
   */
  exists() {
    return existsSync(this.filePath);
  }
}
