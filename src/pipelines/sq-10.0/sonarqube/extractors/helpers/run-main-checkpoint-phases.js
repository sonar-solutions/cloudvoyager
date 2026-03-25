import logger from '../../../../../shared/utils/logger.js';
import { checkShutdown } from '../../../../../shared/utils/shutdown.js';

// -------- Run Checkpoint Phases (Main Branch) --------

/**
 * Execute checkpoint-guarded phases for main branch extraction.
 * @param {Array} phases - Phase definitions
 * @param {object} journal - CheckpointJournal
 * @param {object} cache - ExtractionCache
 * @param {Function} shutdownCheck - () => boolean
 */
export async function runMainCheckpointPhases(phases, journal, cache, shutdownCheck) {
  for (const phase of phases) {
    checkShutdown(shutdownCheck);

    if (journal.isPhaseCompleted(phase.name)) {
      logger.info(`${phase.label} — cached, loading from disk`);
      const cached = await cache.load(phase.name, 'main');
      if (cached !== null) { phase.restore(cached); continue; }
      logger.warn(`Cache miss for ${phase.name}, re-extracting`);
    }

    logger.info(`${phase.label}...`);
    await journal.startPhase(phase.name);
    try {
      const result = await phase.fn();
      await cache.save(phase.name, 'main', result);
      await journal.completePhase(phase.name);
    } catch (error) {
      await journal.failPhase(phase.name, error.message);
      throw error;
    }
  }
}
