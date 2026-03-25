// -------- Check Disk Space --------

import { statfsSync } from 'node:fs';
import { dirname } from 'node:path';
import logger from '../../../utils/logger.js';
import { StateError } from '../../../utils/errors.js';

const MIN_DISK_SPACE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Check available disk space before writing.
 * @param {string} filePath - File path to check disk space for
 * @throws {StateError} if insufficient disk space
 */
export function checkDiskSpace(filePath) {
  try {
    const dir = dirname(filePath);
    const stats = statfsSync(dir);
    const availableBytes = stats.bavail * stats.bsize;
    if (availableBytes < MIN_DISK_SPACE_BYTES) {
      throw new StateError(
        `Insufficient disk space: ${Math.round(availableBytes / 1024 / 1024)}MB available, need at least 10MB`
      );
    }
  } catch (error) {
    if (error instanceof StateError) throw error;
    logger.debug(`Could not check disk space: ${error.message}`);
  }
}
