import logger from '../../../../shared/utils/logger.js';

// -------- Check if Main Branch is Included by CSV Filter --------

export async function checkMainBranchIncluded({ includeBranches, sonarQubeClient, projectKey, isIncremental, stateTracker, journal, lockFile }) {
  if (!includeBranches) return null;

  const sqBranches = await sonarQubeClient.getBranches();
  const sqMainBranch = sqBranches.find(b => b.isMain);
  const sqMainBranchName = sqMainBranch?.name || 'main';

  if (includeBranches.has(sqMainBranchName)) return null;

  logger.warn(`Main branch '${sqMainBranchName}' is excluded by CSV for project ${projectKey} — skipping entire project`);
  const zeroStats = { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] };

  if (isIncremental) await stateTracker.recordTransfer(zeroStats);
  if (journal) await journal.markCompleted();
  await lockFile.release();

  return { projectKey, sonarCloudProjectKey: null, stats: zeroStats };
}
