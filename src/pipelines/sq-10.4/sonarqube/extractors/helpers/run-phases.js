import logger from '../../../../../shared/utils/logger.js';
import { checkShutdown } from '../../../../../shared/utils/shutdown.js';

// -------- Main Logic --------

/**
 * Run extraction phases with checkpoint journal support.
 * Completed phases are restored from cache; in-progress phases are re-executed.
 *
 * @param {Array<object>} phases - Phase definitions with name, label, fn, restore
 * @param {object} journal - CheckpointJournal instance
 * @param {object} cache - ExtractionCache instance
 * @param {Function} shutdownCheck - () => boolean
 * @param {string} cacheKey - Cache partition key ('main' or branch name)
 */
export async function runPhases(phases, journal, cache, shutdownCheck, cacheKey = 'main') {
  for (const phase of phases) {
    checkShutdown(shutdownCheck);

    if (journal.isPhaseCompleted(phase.name)) {
      logger.info(`${phase.label} — cached, loading from disk`);
      const cached = await cache.load(phase.name, cacheKey);
      if (cached !== null) {
        phase.restore(cached);
        continue;
      }
      logger.warn(`Cache miss for ${phase.name}, re-extracting`);
    }

    logger.info(`${phase.label}...`);
    await journal.startPhase(phase.name);
    try {
      const result = await phase.fn();
      await cache.save(phase.name, cacheKey, result);
      await journal.completePhase(phase.name);
    } catch (error) {
      await journal.failPhase(phase.name, error.message);
      throw error;
    }
  }
}
