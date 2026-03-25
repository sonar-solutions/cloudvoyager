import { StateTracker } from '../../../../shared/state/tracker.js';
import { LockFile } from '../../../../shared/state/lock.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Initialize State & Lock --------

/**
 * Acquire lock file and initialize state tracker.
 * @returns {Promise<{lockFile, stateTracker}>}
 */
export async function initState(transferConfig, forceUnlock) {
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

  const summary = stateTracker.getSummary();
  if (summary.lastSync) {
    logger.info(`Last sync: ${summary.lastSync}`);
    logger.info(`Previously processed: ${summary.processedIssuesCount} issues`);
  }

  return { lockFile, stateTracker };
}
