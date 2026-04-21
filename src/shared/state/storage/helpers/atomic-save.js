// -------- Atomic Save --------

import { rename, open } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import logger from '../../../utils/logger.js';
import { StateError } from '../../../utils/errors.js';
import { checkDiskSpace } from './check-disk-space.js';

/**
 * Save state to file atomically (write-to-temp, fsync, rename).
 * @param {string} filePath - Target file path
 * @param {object} state - State object to save
 */
export async function atomicSave(filePath, state) {
  try {
    logger.debug(`Saving state to: ${filePath}`);
    checkDiskSpace(filePath);

    // Write new content to temp file first (primary still exists as crash-safe fallback)
    const tmpPath = `${filePath}.tmp`;
    const content = JSON.stringify(state, null, 2);
    const fd = await open(tmpPath, 'w');
    try {
      await fd.writeFile(content, 'utf-8');
      await fd.sync();
    } finally {
      await fd.close();
    }

    // Backup current file (primary still exists at this point if we crash)
    if (existsSync(filePath)) {
      try {
        await rename(filePath, `${filePath}.backup`);
      } catch (err) {
        logger.debug(`Could not create backup: ${err.message}`);
      }
    }

    // Atomically replace primary with verified temp
    await rename(tmpPath, filePath);

    logger.info(`Saved state to ${filePath}`);
  } catch (error) {
    if (error instanceof StateError) throw error;
    throw new StateError(`Failed to save state: ${error.message}`);
  }
}
