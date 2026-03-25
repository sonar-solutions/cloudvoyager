import logger from '../../../../../../../../shared/utils/logger.js';

// -------- Check Branch Skip --------

/** Check if a branch should be skipped (shutdown, already completed, etc.). */
export function checkBranchSkip(branchName, shutdownCheck, isIncremental, stateTracker, journal) {
  if (shutdownCheck()) return { skipped: true, branchName, reason: 'shutdown' };

  if (isIncremental && stateTracker.isBranchCompleted(branchName)) {
    logger.info(`Branch '${branchName}' already completed — skipping`);
    return { skipped: true, branchName, reason: 'completed' };
  }

  if (journal?.getBranchStatus(branchName) === 'completed') {
    logger.info(`Branch '${branchName}' already completed in journal — skipping`);
    return { skipped: true, branchName, reason: 'completed', addToTransferred: true };
  }

  return null;
}
