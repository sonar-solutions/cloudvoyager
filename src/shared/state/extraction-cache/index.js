// -------- Extraction Cache --------
import { mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import logger from '../../utils/logger.js';
import { getCacheFilePath } from './helpers/file-path.js';
import { saveToDisk } from './helpers/save-to-disk.js';
import { loadFromDisk } from './helpers/load-from-disk.js';
import { clearBranch } from './helpers/clear-branch.js';
import { purgeStale } from './helpers/purge-stale.js';

export { createExtractionCache };
export { ExtractionCache } from './helpers/class-wrapper.js';

const DEFAULT_MAX_AGE_DAYS = 7;

// -------- Factory Function --------
function createExtractionCache(cacheDir, options = {}) {
  const maxAgeDays = options.maxAgeDays || DEFAULT_MAX_AGE_DAYS;

  async function ensureDir(subDir = '') {
    const dir = subDir ? join(cacheDir, subDir) : cacheDir;
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    return dir;
  }

  return {
    get cacheDir() { return cacheDir; },
    get maxAgeDays() { return maxAgeDays; },
    async save(phaseName, branchName, data) { await ensureDir(); await saveToDisk(getCacheFilePath(cacheDir, phaseName, branchName), phaseName, branchName, data); },
    async load(phaseName, branchName) { return loadFromDisk(getCacheFilePath(cacheDir, phaseName, branchName), phaseName, branchName); },
    exists(phaseName, branchName) { return existsSync(getCacheFilePath(cacheDir, phaseName, branchName)); },
    async clear() { if (existsSync(cacheDir)) { await rm(cacheDir, { recursive: true, force: true }); logger.info('Extraction cache cleared'); } },
    async clearBranch(branchName) { await clearBranch(cacheDir, branchName); },
    async purgeStale() { await purgeStale(cacheDir, maxAgeDays); },
  };
}
