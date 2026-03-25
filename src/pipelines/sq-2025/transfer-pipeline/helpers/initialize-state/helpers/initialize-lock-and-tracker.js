import { StateTracker } from '../../../../../../shared/state/tracker.js';
import { LockFile } from '../../../../../../shared/state/lock.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Initialize Lock and Tracker --------

/** Acquire lock file and initialize state tracker. */
export async function initializeLockAndTracker(transferConfig, forceUnlock) {
  const lockPath = `${transferConfig.stateFile}.lock`;
  const lockFile = new LockFile(lockPath);
  await lockFile.acquire(forceUnlock);

  let stateTracker;
  try {
    stateTracker = new StateTracker(transferConfig.stateFile);
    await stateTracker.initialize();
  } catch (error) {
    await lockFile.release();
    throw error;
  }

  const stateSummary = stateTracker.getSummary();
  if (stateSummary.lastSync) {
    logger.info(`Last sync: ${stateSummary.lastSync}`);
    logger.info(`Previously processed: ${stateSummary.processedIssuesCount} issues`);
  }

  return { lockFile, stateTracker };
}
