// -------- Cache File Path --------

import { join } from 'node:path';

/**
 * Get the cache file path for a given phase and branch.
 * @param {string} cacheDir - Root cache directory
 * @param {string} phaseName
 * @param {string} branchName
 * @returns {string}
 */
export function getCacheFilePath(cacheDir, phaseName, branchName) {
  const safeBranch = branchName.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safePhase = phaseName.replace(/[^a-zA-Z0-9_:-]/g, '_');
  return join(cacheDir, `${safePhase}__${safeBranch}.json.gz`);
}
