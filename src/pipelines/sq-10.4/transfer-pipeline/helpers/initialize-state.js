import { StateTracker } from '../../../../shared/state/tracker.js';
import { LockFile } from '../../../../shared/state/lock.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Acquire lock file and initialize state tracker.
 *
 * @param {object} transferConfig - Transfer configuration
 * @param {boolean} forceUnlock - Force unlock existing lock
 * @returns {Promise<{ lockFile: object, stateTracker: object }>}
 */
export async function initializeState(transferConfig, forceUnlock) {
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
