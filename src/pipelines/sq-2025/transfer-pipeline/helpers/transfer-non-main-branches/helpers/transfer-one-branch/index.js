import { GracefulShutdownError } from '../../../../../../../shared/utils/errors.js';
import { transferBranch } from '../../../transfer-branch.js';
import { checkBranchSkip } from './helpers/check-branch-skip.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Transfer One Branch --------

/** Transfer a single non-main branch with journal and state tracking. */
export async function transferOneBranch(branch, opts) {
  const { shutdownCheck, isIncremental, stateTracker, journal, cache,
    extractor, extractedData, sonarcloudConfig, sonarCloudProfiles,
    sonarCloudMainBranch, wait, sonarCloudClient,
    sonarCloudRepos, ruleEnrichmentMap } = opts;
  const branchName = branch.name;

  const skipResult = checkBranchSkip(branchName, shutdownCheck, isIncremental, stateTracker, journal);
  if (skipResult) return skipResult;

  try {
    if (journal) await journal.startBranch(branchName);
    logger.info(`--- Extracting branch: ${branchName} ---`);
    const branchData = (journal && cache)
      ? await extractor.extractBranchWithCheckpoints(branchName, extractedData, journal, cache, shutdownCheck)
      : await extractor.extractBranch(branchName, extractedData);

    const branchResult = await transferBranch({
      extractedData: branchData, sonarcloudConfig, sonarCloudProfiles,
      branchName, referenceBranchName: sonarCloudMainBranch,
      wait, sonarCloudClient, label: branchName,
      sonarCloudRepos, ruleEnrichmentMap,
    });

    if (journal) {
      await journal.recordUpload(branchName, branchResult.ceTask?.id);
      await journal.markBranchCompleted(branchName, branchResult.ceTask?.id);
    }
    if (isIncremental) { stateTracker.markBranchCompleted(branchName); await stateTracker.save(); }
    return { branchName, branchResult };
  } catch (error) {
    if (error instanceof GracefulShutdownError) throw error;
    if (journal) await journal.markBranchFailed(branchName, error.message);
    logger.error(`Failed to transfer branch '${branchName}': ${error.message}`);
    logger.warn('Continuing with remaining branches...');
    return { branchName, error: error.message };
  }
}
