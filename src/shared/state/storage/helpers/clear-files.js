// -------- Clear State Files --------

import { unlink } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import logger from '../../../utils/logger.js';

export async function clearFiles(filePath) {
  const filesToClear = [filePath, `${filePath}.backup`, `${filePath}.tmp`];
  for (const file of filesToClear) {
    try {
      if (existsSync(file)) { await unlink(file); logger.debug(`Cleared: ${file}`); }
    } catch (error) {
      logger.debug(`Could not clear ${file}: ${error.message}`);
    }
  }
  logger.info('State file cleared');
}
