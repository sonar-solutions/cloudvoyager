import { CheckpointJournal } from '../../../../shared/state/checkpoint.js';
import { ExtractionCache } from '../../../../shared/state/extraction-cache.js';
import { dirname, join } from 'node:path';
import logger from '../../../../shared/utils/logger.js';

// -------- Initialize Checkpoint Journal and Cache --------

export async function initCheckpoint(transferConfig, projectKey, forceRestart, forceFreshExtract) {
  if (transferConfig.checkpoint?.enabled === false) return { journal: null, cache: null };

  const journalPath = `${transferConfig.stateFile}.journal`;
  if (forceRestart) {
    const tmpJournal = new CheckpointJournal(journalPath);
    if (tmpJournal.exists()) {
      logger.info('--force-restart: clearing existing checkpoint journal');
      await tmpJournal.clear();
    }
  }

  const journal = new CheckpointJournal(journalPath);
  const safeName = projectKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  const cacheDir = join(dirname(transferConfig.stateFile), '.cache', 'extractions', safeName);
  const cache = new ExtractionCache(cacheDir, { maxAgeDays: transferConfig.checkpoint?.cacheMaxAgeDays || 7 });

  if (forceFreshExtract) {
    logger.info('--force-fresh-extract: clearing extraction cache');
    await cache.clear();
  }
  await cache.purgeStale();

  return { journal, cache };
}
