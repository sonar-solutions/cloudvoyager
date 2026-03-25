import logger from '../../../../shared/utils/logger.js';
import { GracefulShutdownError } from '../../../../shared/utils/errors.js';
import { transferBranch } from './transfer-branch.js';

// -------- Transfer Single Non-Main Branch --------

export async function transferSingleNonMainBranch({ branch, extractedData, extractor, sonarcloudConfig, sonarCloudProfiles, sonarCloudMainBranch, wait, sonarCloudClient, journal, cache, stateTracker, isIncremental, shutdownCheck, sonarCloudRepos, ruleEnrichmentMap }) {
  const branchName = branch.name;
  if (shutdownCheck()) return { skipped: true, branchName, reason: 'shutdown' };
  if (isIncremental && stateTracker.isBranchCompleted(branchName)) {
    logger.info(`Branch '${branchName}' already completed — skipping`);
    return { skipped: true, branchName, reason: 'completed' };
  }
  if (journal?.getBranchStatus(branchName) === 'completed') {
    logger.info(`Branch '${branchName}' already completed in journal — skipping`);
    return { skipped: true, branchName, reason: 'completed', addToTransferred: true };
  }
  try {
    if (journal) await journal.startBranch(branchName);
    logger.info(`--- Extracting branch: ${branchName} ---`);
    const branchData = (journal && cache)
      ? await extractor.extractBranchWithCheckpoints(branchName, extractedData, journal, cache, shutdownCheck)
      : await extractor.extractBranch(branchName, extractedData);
    const branchResult = await transferBranch({
      extractedData: branchData, sonarcloudConfig, sonarCloudProfiles,
      branchName, referenceBranchName: sonarCloudMainBranch, wait,
      sonarCloudClient, label: branchName, sonarCloudRepos, ruleEnrichmentMap,
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
    return { branchName, error: error.message };
  }
}
