import { mapConcurrent } from '../../../../../shared/utils/concurrency.js';
import { filterNonMainBranches } from './helpers/filter-non-main-branches.js';
import { waitForMainBranchIfNeeded } from './helpers/wait-for-main-branch.js';
import { transferOneBranch } from './helpers/transfer-one-branch.js';
import { aggregateBranchResults } from './helpers/aggregate-branch-results.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Non-Main Branch Transfer --------

/** Transfer all non-main branches in parallel. */
export async function transferNonMainBranches(opts) {
  const { extractedData, excludeBranches, includeBranches, mainBranchResult,
    sonarCloudClient, sonarCloudMainBranch, wait, aggregatedStats, performanceConfig } = opts;

  const allBranches = extractedData.project.branches || [];
  const nonMainBranches = filterNonMainBranches(allBranches, excludeBranches, includeBranches);

  if (nonMainBranches.length === 0) {
    logger.info('No additional branches to sync (only the main branch exists)');
    return;
  }

  await waitForMainBranchIfNeeded(mainBranchResult, wait, sonarCloudClient);
  logger.info(`Syncing ${nonMainBranches.length} additional branch(es): ${nonMainBranches.map(b => b.name).join(', ')}`);

  const branchResults = await mapConcurrent(
    nonMainBranches,
    (branch) => transferOneBranch(branch, opts),
    { concurrency: performanceConfig?.maxConcurrency || 4, settled: true },
  );

  aggregateBranchResults(branchResults, aggregatedStats);
}
