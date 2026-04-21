// -------- Clear State Files --------

import { unlink } from 'node:fs/promises';
import logger from '../../../utils/logger.js';

export async function clearFiles(filePath) {
  const filesToClear = [filePath, `${filePath}.backup`, `${filePath}.tmp`];
  for (const file of filesToClear) {
    try {
      await unlink(file);
      logger.debug(`Cleared: ${file}`);
    } catch (error) {
      if (error.code !== 'ENOENT') logger.debug(`Could not clear ${file}: ${error.message}`);
    }
  }
  logger.info('State file cleared');
}
