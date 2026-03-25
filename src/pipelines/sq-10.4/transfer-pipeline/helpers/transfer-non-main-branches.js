import { mapConcurrent } from '../../../../shared/utils/concurrency.js';
import { transferSingleBranch } from './transfer-single-branch.js';
import { aggregateBranchResults } from './aggregate-branch-results.js';
import { filterNonMainBranches } from './filter-non-main-branches.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Transfer all non-main branches to SonarCloud.
 * Updates aggregatedStats in-place.
 */
export async function transferNonMainBranches(opts) {
  const { extractedData, mainBranchResult, wait, sonarCloudClient, performanceConfig, aggregatedStats, excludeBranches, includeBranches } = opts;

  const nonMainBranches = filterNonMainBranches(extractedData.project.branches || [], excludeBranches, includeBranches);

  if (nonMainBranches.length === 0) {
    logger.info('No additional branches to sync (only the main branch exists)');
    return;
  }

  // Wait for main branch analysis before syncing non-main branches
  if (!wait && mainBranchResult.ceTask?.id) {
    logger.info(`Waiting for main branch CE task ${mainBranchResult.ceTask.id} to complete...`);
    try {
      await sonarCloudClient.waitForAnalysis(mainBranchResult.ceTask.id, 600);
      logger.info('Main branch analysis completed');
    } catch (error) {
      logger.error(`Main branch analysis did not complete: ${error.message}`);
      logger.warn('Attempting non-main branch transfers anyway...');
    }
  }

  logger.info(`Syncing ${nonMainBranches.length} branch(es): ${nonMainBranches.map(b => b.name).join(', ')}`);

  const branchResults = await mapConcurrent(
    nonMainBranches,
    (branch) => transferSingleBranch({ ...opts, branch }),
    { concurrency: performanceConfig?.maxConcurrency || 4, settled: true },
  );

  aggregateBranchResults(branchResults, aggregatedStats);
}
