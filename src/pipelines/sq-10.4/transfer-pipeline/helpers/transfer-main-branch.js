import { ReportUploader } from '../../sonarcloud/uploader.js';
import { transferBranch } from './transfer-branch.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Transfer the main branch report to SonarCloud.
 * Handles journal tracking and upload deduplication.
 *
 * @param {object} opts - Transfer options
 * @returns {Promise<object>} { stats, ceTask }
 */
export async function transferMainBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, branchName, wait, sonarCloudClient, journal, sonarCloudRepos, ruleEnrichmentMap }) {
  const mainBranchCompleted = journal?.getBranchStatus(branchName) === 'completed';
  const emptyStats = { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0 };

  if (mainBranchCompleted) {
    logger.info(`Main branch '${branchName}' already completed in journal — skipping`);
    const ceTaskInfo = journal.getUploadedCeTask(branchName);
    return { stats: emptyStats, ceTask: ceTaskInfo ? { id: ceTaskInfo.taskId } : null };
  }

  if (journal) await journal.startBranch(branchName);

  // Upload deduplication: check if we already uploaded in this session
  const uploader = new ReportUploader(sonarCloudClient);
  const existingUpload = journal ? await uploader.checkExistingUpload(journal.sessionStartTime) : null;

  if (existingUpload) {
    return { stats: emptyStats, ceTask: existingUpload };
  }

  const result = await transferBranch({
    extractedData, sonarcloudConfig, sonarCloudProfiles, branchName,
    referenceBranchName: branchName, wait, sonarCloudClient, label: 'main',
    isMainBranch: true, sonarCloudRepos, ruleEnrichmentMap,
  });

  if (journal) {
    await journal.recordUpload(branchName, result.ceTask?.id);
    await journal.markBranchCompleted(branchName, result.ceTask?.id);
  }

  return result;
}
