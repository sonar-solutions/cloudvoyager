import { checkShutdown } from '../../../../../../shared/utils/shutdown.js';
import { transferMainBranch } from '../../transfer-main-branch.js';
import { transferNonMainBranches } from '../../transfer-non-main-branches.js';
import { syncTransferMetadata } from '../../sync-transfer-metadata/index.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Run Transfer Phases --------

/** Execute main + non-main branch transfers, metadata sync, and finalize. */
export async function runTransferPhases(opts) {
  const { sonarqubeConfig, sonarcloudConfig, transferConfig, sonarCloudProfiles, wait, shutdownCheck,
    isIncremental, syncAllBranches, excludeBranches, includeBranches,
    lockFile, stateTracker, journal, cache, ruleEnrichmentMap,
    sonarQubeClient, sonarCloudClient, sonarCloudMainBranch, sonarCloudRepos,
    extractedData, extractor, projectKey, performanceConfig } = opts;

  const { mainBranchResult, aggregatedStats } = await transferMainBranch({
    journal, sonarCloudMainBranch, sonarCloudClient, extractedData,
    sonarcloudConfig, sonarCloudProfiles, wait, sonarCloudRepos, ruleEnrichmentMap, stateTracker, isIncremental,
  });
  checkShutdown(shutdownCheck);

  if (syncAllBranches) {
    await transferNonMainBranches({ extractedData, excludeBranches, includeBranches, mainBranchResult, sonarCloudClient, sonarCloudMainBranch, wait, aggregatedStats, extractor, journal, cache, shutdownCheck, stateTracker, isIncremental, sonarcloudConfig, sonarCloudProfiles, sonarCloudRepos, ruleEnrichmentMap, performanceConfig });
  }

  // -------- Phase 2: Metadata Sync --------
  checkShutdown(shutdownCheck);
  const metadataStats = await syncTransferMetadata({
    sonarQubeClient, sonarCloudClient, sonarcloudConfig, transferConfig, performanceConfig,
  });

  if (isIncremental) await stateTracker.recordTransfer(aggregatedStats);
  if (journal) await journal.markCompleted();
  await lockFile.release();

  logger.info(`Transfer completed for project: ${projectKey} — ${aggregatedStats.branchesTransferred.length} branch(es)`);
  return { projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey, stats: aggregatedStats, metadataStats };
}
