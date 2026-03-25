import logger from '../../../../../shared/utils/logger.js';
import { checkShutdown } from '../../../../../shared/utils/shutdown.js';

// -------- Main Logic --------

/**
 * Run extraction phases for a branch with checkpoint journal support.
 *
 * @param {Array<object>} phases - Phase definitions
 * @param {string} branch - Branch name
 * @param {object} journal - CheckpointJournal instance
 * @param {object} cache - ExtractionCache instance
 * @param {Function} shutdownCheck - () => boolean
 */
export async function runBranchPhases(phases, branch, journal, cache, shutdownCheck) {
  for (const phase of phases) {
    checkShutdown(shutdownCheck);

    if (journal.isBranchPhaseCompleted(branch, phase.name)) {
      logger.info(`${phase.label} — cached, loading from disk`);
      const cached = await cache.load(phase.name, branch);
      if (cached !== null) {
        phase.restore(cached);
        continue;
      }
      logger.warn(`Cache miss for ${phase.name} on branch '${branch}', re-extracting`);
    }

    logger.info(`${phase.label}...`);
    await journal.startBranchPhase(branch, phase.name);
    try {
      const result = await phase.fn();
      await cache.save(phase.name, branch, result);
      await journal.completeBranchPhase(branch, phase.name);
    } catch (error) {
      await journal.failBranchPhase(branch, phase.name, error.message);
      throw error;
    }
  }
}
