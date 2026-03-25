import logger from '../../../../shared/utils/logger.js';

// -------- Check If Main Branch Excluded by CSV --------

/**
 * If CSV branch includes exclude the main branch, skip the entire project.
 * @returns {object|null} Early return result, or null to continue
 */
export async function checkMainBranchExcluded({ includeBranches, sonarQubeClient, projectKey, isIncremental, stateTracker, journal, lockFile, sonarcloudConfig }) {
  if (!includeBranches) return null;
  const sqBranches = await sonarQubeClient.getBranches();
  const sqMainBranch = sqBranches.find(b => b.isMain);
  const sqMainBranchName = sqMainBranch?.name || 'main';
  if (includeBranches.has(sqMainBranchName)) return null;
  logger.warn(`Main branch '${sqMainBranchName}' excluded by CSV for ${projectKey} — skipping`);
  const zeroStats = { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] };
  if (isIncremental) await stateTracker.recordTransfer(zeroStats);
  if (journal) await journal.markCompleted();
  await lockFile.release();
  return {
    projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey,
    stats: { issuesTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] },
  };
}
