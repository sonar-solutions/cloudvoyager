import { checkShutdown } from '../../../../shared/utils/shutdown.js';
import { prepareProjectTransfer } from './prepare-project-transfer.js';
import { validateMainBranchIncluded } from './validate-main-branch.js';
import { extractAndFetchMetadata } from './extract-and-fetch-metadata.js';
import { transferMainBranch } from './transfer-main-branch.js';
import { transferNonMainBranches } from './transfer-non-main-branches.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Core transfer logic: extract, build, upload for all branches.
 */
export async function executeTransfer(opts) {
  const { sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig = {}, wait = false, skipConnectionTest = false, projectName = null, ruleEnrichmentMap: prebuiltEnrichmentMap = null, projectKey, shutdownCheck, isIncremental, stateTracker, journal, cache, lockFile } = opts;

  const syncAllBranches = transferConfig.syncAllBranches !== false;
  const excludeBranches = new Set(transferConfig.excludeBranches || []);
  const includeBranches = transferConfig.includeBranches || null;

  const { sonarQubeClient, sonarCloudClient } = await prepareProjectTransfer({ sonarqubeConfig, sonarcloudConfig, skipConnectionTest, journal, projectKey, shutdownCheck, projectName });

  const skipResult = await validateMainBranchIncluded({ includeBranches, sonarQubeClient, projectKey, isIncremental, stateTracker, journal, lockFile });
  if (skipResult) return skipResult;

  checkShutdown(shutdownCheck);

  const { extractor, extractedData, sonarCloudProfiles, sonarCloudMainBranch, sonarCloudRepos, ruleEnrichmentMap } = await extractAndFetchMetadata({ sonarqubeConfig, sonarcloudConfig, transferConfig, performanceConfig, sonarQubeClient, sonarCloudClient, isIncremental, stateTracker, journal, cache, shutdownCheck, prebuiltEnrichmentMap });

  checkShutdown(shutdownCheck);

  const mainBranchResult = await transferMainBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName: sonarCloudMainBranch, wait, sonarCloudClient, journal, sonarCloudRepos, ruleEnrichmentMap });
  const aggregatedStats = { issuesTransferred: mainBranchResult.stats.issuesTransferred || 0, hotspotsTransferred: mainBranchResult.stats.hotspotsTransferred || 0, componentsTransferred: mainBranchResult.stats.componentsTransferred || 0, sourcesTransferred: mainBranchResult.stats.sourcesTransferred || 0, linesOfCode: mainBranchResult.stats.linesOfCode || 0, branchesTransferred: [sonarCloudMainBranch] };

  if (isIncremental) { stateTracker.markBranchCompleted(sonarCloudMainBranch); await stateTracker.save(); }
  checkShutdown(shutdownCheck);

  if (syncAllBranches) {
    await transferNonMainBranches({ extractedData, sonarcloudConfig, sonarCloudProfiles, mainBranchResult, sonarCloudMainBranch, wait, sonarCloudClient, extractor, journal, cache, stateTracker, isIncremental, shutdownCheck, excludeBranches, includeBranches, performanceConfig, aggregatedStats, sonarCloudRepos, ruleEnrichmentMap });
  }

  if (isIncremental) await stateTracker.recordTransfer(aggregatedStats);
  if (journal) await journal.markCompleted();

  logger.info(`Transfer completed for project: ${projectKey} — ${aggregatedStats.branchesTransferred.length} branch(es)`);
  return { projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey, stats: aggregatedStats };
}
