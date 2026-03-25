import { mapConcurrent } from '../../../../shared/utils/concurrency.js';
import { transferOneBranch } from './transfer-one-branch.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Transfer Non-Main Branches --------

export async function transferNonMainBranches({ extractedData, excludeBranches, includeBranches, sonarCloudMainBranch, mainBranchCeTaskId, wait, sonarCloudClient, extractor, journal, cache, shutdownCheck, sonarcloudConfig, sonarCloudProfiles, sonarCloudRepos, ruleEnrichmentMap, isIncremental, stateTracker, performanceConfig }) {
  const allBranches = extractedData.project.branches || [];
  const nonMainBranches = allBranches.filter(b => {
    if (b.isMain) return false;
    if (excludeBranches.has(b.name)) return false;
    if (includeBranches && !includeBranches.has(b.name)) return false;
    return true;
  });

  if (nonMainBranches.length === 0) {
    logger.info('No additional branches to sync (only the main branch exists)');
    return [];
  }

  await waitForMainBranchIfNeeded(sonarCloudClient, mainBranchCeTaskId, wait);
  logger.info(`Syncing ${nonMainBranches.length} additional branch(es): ${nonMainBranches.map(b => b.name).join(', ')}`);

  return mapConcurrent(nonMainBranches, (branch) => transferOneBranch({
    branch, extractedData, extractor, journal, cache, shutdownCheck, sonarcloudConfig,
    sonarCloudProfiles, sonarCloudMainBranch, wait, sonarCloudClient, sonarCloudRepos,
    ruleEnrichmentMap, isIncremental, stateTracker,
  }), { concurrency: performanceConfig?.maxConcurrency || 4, settled: true });
}

// -------- Helpers --------

async function waitForMainBranchIfNeeded(sonarCloudClient, ceTaskId, wait) {
  if (wait || !ceTaskId) return;
  logger.info(`Waiting for main branch CE task ${ceTaskId} to complete before syncing non-main branches...`);
  try {
    await sonarCloudClient.waitForAnalysis(ceTaskId, 600);
    logger.info('Main branch analysis completed — proceeding with non-main branches');
  } catch (error) {
    logger.error(`Main branch analysis did not complete successfully: ${error.message}`);
    logger.warn('Attempting non-main branch transfers anyway...');
  }
}
