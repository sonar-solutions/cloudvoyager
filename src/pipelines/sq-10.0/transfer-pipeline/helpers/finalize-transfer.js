import logger from '../../../../shared/utils/logger.js';
import { checkShutdown } from '../../../../shared/utils/shutdown.js';
import { transferNonMainBranches } from './transfer-non-main-branches.js';
import { waitForMainAnalysis } from './wait-for-main-analysis.js';
import { syncTransferMetadata } from './sync-transfer-metadata/index.js';

// -------- Finalize Transfer (non-main branches + cleanup) --------

export async function finalizeTransfer({ mainResult, sonarCloudMainBranch, syncAllBranches, excludeBranches, includeBranches, extractedData, extractor, sonarcloudConfig, sonarCloudProfiles, wait, sonarCloudClient, sonarQubeClient, journal, cache, stateTracker, isIncremental, shutdownCheck, performanceConfig, sonarCloudRepos, ruleEnrichmentMap, projectKey, lockFile, transferConfig }) {
  const aggregatedStats = {
    issuesTransferred: mainResult.stats.issuesTransferred || 0,
    hotspotsTransferred: mainResult.stats.hotspotsTransferred || 0,
    componentsTransferred: mainResult.stats.componentsTransferred || 0,
    sourcesTransferred: mainResult.stats.sourcesTransferred || 0,
    linesOfCode: mainResult.stats.linesOfCode || 0,
    branchesTransferred: [sonarCloudMainBranch],
  };
  if (isIncremental) { stateTracker.markBranchCompleted(sonarCloudMainBranch); await stateTracker.save(); }
  checkShutdown(shutdownCheck);
  if (syncAllBranches) {
    const allBranches = extractedData.project.branches || [];
    const nonMainBranches = allBranches.filter(b => !b.isMain && !excludeBranches.has(b.name) && (!includeBranches || includeBranches.has(b.name)));
    if (nonMainBranches.length > 0) {
      await waitForMainAnalysis(sonarCloudClient, mainResult.ceTask?.id, wait);
      logger.info(`Syncing ${nonMainBranches.length} additional branch(es): ${nonMainBranches.map(b => b.name).join(', ')}`);
      await transferNonMainBranches({ nonMainBranches, extractedData, extractor, sonarcloudConfig, sonarCloudProfiles, sonarCloudMainBranch, wait, sonarCloudClient, journal, cache, stateTracker, isIncremental, shutdownCheck, performanceConfig, sonarCloudRepos, ruleEnrichmentMap, aggregatedStats });
    } else {
      logger.info('No additional branches to sync (only the main branch exists)');
    }
  }
  // -------- Phase 2: Metadata Sync --------
  const metadataStats = await syncTransferMetadata({
    sonarQubeClient, sonarCloudClient, sonarcloudConfig, transferConfig, performanceConfig,
  });

  if (isIncremental) await stateTracker.recordTransfer(aggregatedStats);
  if (journal) await journal.markCompleted();
  await lockFile.release();
  logger.info(`Transfer completed for project: ${projectKey} — ${aggregatedStats.branchesTransferred.length} branch(es)`);
  return { projectKey, sonarCloudProjectKey: sonarcloudConfig.projectKey, stats: aggregatedStats, metadataStats };
}
