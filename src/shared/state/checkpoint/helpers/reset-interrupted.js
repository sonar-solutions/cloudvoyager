// -------- Reset Interrupted Phases/Branches --------

import logger from '../../../utils/logger.js';

/**
 * Reset interrupted phases to pending for re-execution.
 * @param {object} phases - Phases map from journal
 */
export function resetInterruptedPhases(phases) {
  for (const [name, phase] of Object.entries(phases)) {
    if (phase.status === 'in_progress') {
      logger.info(`Phase '${name}' was interrupted — will re-execute`);
      phase.status = 'pending';
      delete phase.startedAt;
    }
  }
}

/**
 * Reset interrupted branches and their phases to pending.
 * @param {object} branches - Branches map from journal
 */
export function resetInterruptedBranches(branches) {
  for (const [name, branch] of Object.entries(branches)) {
    if (branch.status === 'in_progress') {
      logger.info(`Branch '${name}' was interrupted — will re-execute from last completed phase`);
      branch.status = 'pending';
      resetInterruptedPhases(branch.phases || {});
    }
  }
}
