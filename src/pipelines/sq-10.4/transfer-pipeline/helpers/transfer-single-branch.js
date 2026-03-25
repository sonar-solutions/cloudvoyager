import { GracefulShutdownError } from '../../../../shared/utils/errors.js';
import { transferBranch } from './transfer-branch.js';
import { checkBranchSkip } from './check-branch-skip.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Transfer a single non-main branch. Called from mapConcurrent.
 *
 * @param {object} opts - Transfer options including branch
 * @returns {Promise<object>} { branchName, branchResult } or { skipped, branchName }
 */
export async function transferSingleBranch(opts) {
  const { branch, extractedData, sonarcloudConfig, sonarCloudProfiles, sonarCloudMainBranch, wait, sonarCloudClient, extractor, journal, cache, stateTracker, isIncremental, shutdownCheck, sonarCloudRepos, ruleEnrichmentMap } = opts;
  const branchName = branch.name;

  const skipResult = checkBranchSkip(branchName, { shutdownCheck, isIncremental, stateTracker, journal });
  if (skipResult) return skipResult;

  try {
    if (journal) await journal.startBranch(branchName);
    logger.info(`--- Extracting branch: ${branchName} ---`);

    const branchData = (journal && cache)
      ? await extractor.extractBranchWithCheckpoints(branchName, extractedData, journal, cache, shutdownCheck)
      : await extractor.extractBranch(branchName, extractedData);

    const branchResult = await transferBranch({
      extractedData: branchData, sonarcloudConfig, sonarCloudProfiles, branchName,
      referenceBranchName: sonarCloudMainBranch, wait, sonarCloudClient, label: branchName,
      sonarCloudRepos, ruleEnrichmentMap,
    });

    if (journal) { await journal.recordUpload(branchName, branchResult.ceTask?.id); await journal.markBranchCompleted(branchName, branchResult.ceTask?.id); }
    if (isIncremental) { stateTracker.markBranchCompleted(branchName); await stateTracker.save(); }
    return { branchName, branchResult };
  } catch (error) {
    if (error instanceof GracefulShutdownError) throw error;
    if (journal) await journal.markBranchFailed(branchName, error.message);
    logger.error(`Failed to transfer branch '${branchName}': ${error.message}`);
    return { branchName, error: error.message };
  }
}
