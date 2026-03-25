import { mapConcurrent } from '../../../../shared/utils/concurrency.js';
import { transferSingleNonMainBranch } from './transfer-single-non-main-branch.js';
import { aggregateBranchStats } from './aggregate-branch-stats.js';

// -------- Transfer Non-Main Branches --------

export async function transferNonMainBranches({ nonMainBranches, extractedData, extractor, sonarcloudConfig, sonarCloudProfiles, sonarCloudMainBranch, wait, sonarCloudClient, journal, cache, stateTracker, isIncremental, shutdownCheck, performanceConfig, sonarCloudRepos, ruleEnrichmentMap, aggregatedStats }) {
  const branchResults = await mapConcurrent(
    nonMainBranches,
    async (branch) => transferSingleNonMainBranch({ branch, extractedData, extractor, sonarcloudConfig, sonarCloudProfiles, sonarCloudMainBranch, wait, sonarCloudClient, journal, cache, stateTracker, isIncremental, shutdownCheck, sonarCloudRepos, ruleEnrichmentMap }),
    { concurrency: performanceConfig?.maxConcurrency || 4, settled: true }
  );
  aggregateBranchStats(aggregatedStats, branchResults);
}
