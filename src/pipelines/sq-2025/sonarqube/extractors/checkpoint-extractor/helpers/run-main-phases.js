import logger from '../../../../../../shared/utils/logger.js';
import { checkShutdown } from '../../../../../../shared/utils/shutdown.js';

// -------- Run Main Branch Phases --------

/**
 * Execute each phase in order with journal/cache checkpoint support.
 * Completed phases are loaded from cache; incomplete phases are (re-)executed.
 */
export async function runMainPhases(phases, journal, cache, shutdownCheck) {
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
