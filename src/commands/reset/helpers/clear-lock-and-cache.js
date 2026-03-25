// -------- Clear Lock And Cache --------

import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import logger from '../../../shared/utils/logger.js';

export async function clearLockAndCache(stateFile) {
  const lockPath = `${stateFile}.lock`;
  if (existsSync(lockPath)) {
    await rm(lockPath, { force: true });
    logger.info(`Removed lock file: ${lockPath}`);
  }

  const cacheDir = join(dirname(stateFile), '.cache');
  if (existsSync(cacheDir)) {
    await rm(cacheDir, { recursive: true, force: true });
    logger.info(`Removed extraction cache: ${cacheDir}`);
  }
}
