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

    // Backup current file before overwriting
    if (existsSync(filePath)) {
      try {
        await rename(filePath, `${filePath}.backup`);
      } catch (err) {
        logger.debug(`Could not create backup: ${err.message}`);
      }
    }

    // Write to temp, fsync, rename
    const tmpPath = `${filePath}.tmp`;
    const content = JSON.stringify(state, null, 2);
    const fd = await open(tmpPath, 'w');
    try {
      await fd.writeFile(content, 'utf-8');
      await fd.sync();
    } finally {
      await fd.close();
    }
    await rename(tmpPath, filePath);

    logger.info(`Saved state to ${filePath}`);
  } catch (error) {
    if (error instanceof StateError) throw error;
    throw new StateError(`Failed to save state: ${error.message}`);
  }
}
