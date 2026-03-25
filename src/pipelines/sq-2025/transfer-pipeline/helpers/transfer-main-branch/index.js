import { executeMainBranchTransfer } from './helpers/execute-main-branch-transfer.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Branch Transfer --------

/** Transfer the main branch — handles journal, dedup, and stats aggregation. */
export async function transferMainBranch(opts) {
  const { journal, sonarCloudMainBranch, stateTracker, isIncremental } = opts;

  const mainBranchCompleted = journal?.getBranchStatus(sonarCloudMainBranch) === 'completed';

  let mainBranchResult;
  if (mainBranchCompleted) {
    logger.info(`Main branch '${sonarCloudMainBranch}' already completed — skipping`);
    const ceTaskInfo = journal.getUploadedCeTask(sonarCloudMainBranch);
    mainBranchResult = {
      stats: { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0 },
      ceTask: ceTaskInfo ? { id: ceTaskInfo.taskId } : null,
    };
  } else {
    mainBranchResult = await executeMainBranchTransfer(opts);
  }

  const aggregatedStats = {
    issuesTransferred: mainBranchResult.stats.issuesTransferred || 0,
    hotspotsTransferred: mainBranchResult.stats.hotspotsTransferred || 0,
    componentsTransferred: mainBranchResult.stats.componentsTransferred || 0,
    sourcesTransferred: mainBranchResult.stats.sourcesTransferred || 0,
    linesOfCode: mainBranchResult.stats.linesOfCode || 0,
    branchesTransferred: [sonarCloudMainBranch],
  };

  if (isIncremental) {
    stateTracker.markBranchCompleted(sonarCloudMainBranch);
    await stateTracker.save();
  }

  return { mainBranchResult, aggregatedStats };
}
