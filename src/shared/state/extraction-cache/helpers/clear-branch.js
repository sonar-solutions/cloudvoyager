// -------- Clear Branch Cache --------

import { existsSync } from 'node:fs';
import { readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import logger from '../../../utils/logger.js';

/**
 * Clear cache files for a specific branch.
 * @param {string} cacheDir - Cache directory
 * @param {string} branchName
 */
export async function clearBranch(cacheDir, branchName) {
  if (!existsSync(cacheDir)) return;

  const safeBranch = branchName.replace(/[^a-zA-Z0-9_-]/g, '_');
  try {
    const files = await readdir(cacheDir);
    for (const file of files) {
      if (file.includes(`__${safeBranch}.json.gz`)) {
        const filePath = join(cacheDir, file);
        await rm(filePath, { force: true });
        logger.debug(`Cleared cache: ${file}`);
      }
    }
  } catch (error) {
    logger.debug(`Failed to clear branch cache: ${error.message}`);
  }
}
