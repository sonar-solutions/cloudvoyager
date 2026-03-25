// -------- Purge Stale Cache Files --------

import { existsSync } from 'node:fs';
import { readdir, stat, rm } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../utils/logger.js';

/**
 * Purge cache files older than maxAgeDays.
 * @param {string} cacheDir - Cache directory
 * @param {number} maxAgeDays - Maximum age in days
 */
export async function purgeStale(cacheDir, maxAgeDays) {
  if (!existsSync(cacheDir)) return;

  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let purgedCount = 0;

  try {
    const files = await readdir(cacheDir);
    for (const file of files) {
      const filePath = join(cacheDir, file);
      const fileStat = await stat(filePath);
      if (now - fileStat.mtimeMs > maxAgeMs) {
        await rm(filePath, { force: true });
        purgedCount++;
      }
    }
    if (purgedCount > 0) {
      logger.info(`Purged ${purgedCount} stale cache file(s) older than ${maxAgeDays} days`);
    }
  } catch (error) {
    logger.debug(`Failed to purge stale cache: ${error.message}`);
  }
}
