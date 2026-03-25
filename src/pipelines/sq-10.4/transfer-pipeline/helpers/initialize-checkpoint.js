import { CheckpointJournal } from '../../../../shared/state/checkpoint.js';
import { ExtractionCache } from '../../../../shared/state/extraction-cache.js';
import { dirname, join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Initialize checkpoint journal and extraction cache.
 *
 * @param {object} transferConfig - Transfer configuration
 * @param {string} projectKey - SonarQube project key
 * @param {boolean} forceRestart - Clear existing journal
 * @param {boolean} forceFreshExtract - Clear extraction cache
 * @returns {Promise<{ journal: object|null, cache: object|null }>}
 */
export async function initializeCheckpoint(transferConfig, projectKey, forceRestart, forceFreshExtract) {
  const checkpointEnabled = transferConfig.checkpoint?.enabled !== false;
  if (!checkpointEnabled) return { journal: null, cache: null };

  const journalPath = `${transferConfig.stateFile}.journal`;

  if (forceRestart) {
    const tmpJournal = new CheckpointJournal(journalPath);
    if (tmpJournal.exists()) {
      logger.info('--force-restart: clearing existing checkpoint journal');
      await tmpJournal.clear();
    }
  }

  const journal = new CheckpointJournal(journalPath);
  const safeProjKey = projectKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cacheDir = join(dirname(transferConfig.stateFile), '.cache', 'extractions', safeProjKey);
  const cache = new ExtractionCache(cacheDir, { maxAgeDays: transferConfig.checkpoint?.cacheMaxAgeDays || 7 });

  if (forceFreshExtract) {
    logger.info('--force-fresh-extract: clearing extraction cache');
    await cache.clear();
  }

  await cache.purgeStale();
  return { journal, cache };
}
