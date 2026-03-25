import logger from '../../../../../../shared/utils/logger.js';

// -------- Check Main Branch Included --------

/** Return early result if main branch is excluded by CSV. */
export async function checkMainBranchIncluded(sqClient, includeBranches, projectKey, isIncremental, stateTracker, journal, lockFile, scConfig) {
  const sqBranches = await sqClient.getBranches();
  const sqMainBranch = sqBranches.find(b => b.isMain);
  const sqMainBranchName = sqMainBranch?.name || 'main';

  if (includeBranches.has(sqMainBranchName)) return null;

  logger.warn(`Main branch '${sqMainBranchName}' excluded by CSV for project ${projectKey} — skipping`);
  const zeroStats = { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0, branchesTransferred: [] };
  if (isIncremental) await stateTracker.recordTransfer(zeroStats);
  if (journal) await journal.markCompleted();
  await lockFile.release();
  return { projectKey, sonarCloudProjectKey: scConfig.projectKey, stats: zeroStats };
}
