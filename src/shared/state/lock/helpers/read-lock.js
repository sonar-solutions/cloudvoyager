// -------- Read Lock File --------

import { readFile } from 'node:fs/promises';

/**
 * Read and parse the lock file.
 * @param {string} lockPath
 * @returns {Promise<object|null>}
 */
export async function readLock(lockPath) {
  try {
    const content = await readFile(lockPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}
