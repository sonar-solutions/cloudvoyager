// -------- Load with Fallbacks --------

import { existsSync } from 'node:fs';
import { copyFile } from 'node:fs/promises';
import logger from '../../../utils/logger.js';
import { tryLoadFile } from './try-load-file.js';

export async function loadWithFallbacks(filePath) {
  const mainState = await tryLoadFile(filePath);
  if (mainState !== null) return mainState;

  const backupPath = `${filePath}.backup`;
  if (existsSync(backupPath)) {
    logger.warn(`Main state file missing or corrupt, falling back to backup: ${backupPath}`);
    const backupState = await tryLoadFile(backupPath);
    if (backupState !== null) {
      try { await copyFile(backupPath, filePath); logger.info('Restored state from backup file'); } catch { /* best effort */ }
      return backupState;
    }
    logger.warn('Backup state file is also corrupt');
  }

  const tmpPath = `${filePath}.tmp`;
  if (existsSync(tmpPath)) {
    logger.warn(`Found orphaned temp file, attempting recovery: ${tmpPath}`);
    const tmpState = await tryLoadFile(tmpPath);
    if (tmpState !== null) {
      try { await copyFile(tmpPath, filePath); logger.info('Recovered state from orphaned temp file'); } catch { /* best effort */ }
      return tmpState;
    }
    logger.warn('Orphaned temp file is also corrupt');
  }

  logger.debug('No valid state file found');
  return null;
}
