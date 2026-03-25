import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Validate that the main branch is included when CSV branch filters are active.
 * Returns an early-exit result if main branch is excluded, or null to continue.
 *
 * @param {object} opts - Validation options
 * @returns {Promise<object|null>} Early-exit result or null
 */
export async function validateMainBranchIncluded({ includeBranches, sonarQubeClient, projectKey, isIncremental, stateTracker, journal, lockFile }) {
  if (!includeBranches) return null;

  const sqBranches = await sonarQubeClient.getBranches();
  const sqMainBranch = sqBranches.find(b => b.isMain);
  const sqMainBranchName = sqMainBranch?.name || 'main';

  if (includeBranches.has(sqMainBranchName)) return null;

  logger.warn(`Main branch '${sqMainBranchName}' excluded by CSV for project ${projectKey} — skipping entire project`);

  const zeroStats = { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] };
  if (isIncremental) await stateTracker.recordTransfer(zeroStats);
  if (journal) await journal.markCompleted();
  await lockFile.release();

  return {
    projectKey,
    sonarCloudProjectKey: projectKey,
    stats: { issuesTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] },
  };
}
