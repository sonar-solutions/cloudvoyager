import { StateTracker } from '../../../../shared/state/tracker.js';
import { LockFile } from '../../../../shared/state/lock.js';
import { initCheckpoint } from './init-checkpoint.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Initialize State, Lock, Journal, and Cache --------

export async function initState({ transferConfig, projectKey, forceRestart, forceFreshExtract, forceUnlock }) {
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

  const { journal, cache } = await initCheckpoint(transferConfig, projectKey, forceRestart, forceFreshExtract);

  return { lockFile, stateTracker, journal, cache };
}
