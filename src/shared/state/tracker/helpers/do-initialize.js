// -------- Initialize State Tracker --------

import logger from '../../../utils/logger.js';

export async function doInitialize(storage, lock, state, processedIssuesSet, completedBranchesSet, opts) {
  logger.info('Initializing state tracker...');
  if (opts.acquireLock) await lock.acquire(opts.forceUnlock);
  const saved = await storage.load();
  if (saved) {
    Object.assign(state, saved);
    for (const key of state.processedIssues) processedIssuesSet.add(key);
    for (const name of state.completedBranches) completedBranchesSet.add(name);
    logger.info(`Loaded existing state (last sync: ${state.lastSync || 'never'})`);
    logger.info(`Processed ${state.processedIssues.length} issues previously`);
  } else {
    logger.info('No existing state found, starting fresh');
  }
}
