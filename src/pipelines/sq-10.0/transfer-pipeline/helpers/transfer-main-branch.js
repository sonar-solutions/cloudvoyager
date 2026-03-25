import logger from '../../../../shared/utils/logger.js';
import { ReportUploader } from '../../sonarcloud/uploader.js';
import { transferBranch } from './transfer-branch.js';

// -------- Transfer Main Branch --------

const ZERO_STATS = { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0 };

export async function transferMainBranch({ extractedData, sonarcloudConfig, sonarCloudProfiles, sonarCloudMainBranch, wait, sonarCloudClient, journal, sonarCloudRepos, ruleEnrichmentMap }) {
  const alreadyCompleted = journal?.getBranchStatus(sonarCloudMainBranch) === 'completed';

  if (alreadyCompleted) {
    logger.info(`Main branch '${sonarCloudMainBranch}' already completed in journal — skipping`);
    const ceTaskInfo = journal.getUploadedCeTask(sonarCloudMainBranch);
    return { stats: { ...ZERO_STATS }, ceTask: ceTaskInfo ? { id: ceTaskInfo.taskId } : null };
  }

  if (journal) await journal.startBranch(sonarCloudMainBranch);

  const uploader = new ReportUploader(sonarCloudClient);
  const existingUpload = journal ? await uploader.checkExistingUpload(journal.sessionStartTime) : null;
  if (existingUpload) {
    return { stats: { ...ZERO_STATS }, ceTask: existingUpload };
  }

  const result = await transferBranch({
    extractedData, sonarcloudConfig, sonarCloudProfiles,
    branchName: sonarCloudMainBranch, referenceBranchName: sonarCloudMainBranch,
    wait, sonarCloudClient, label: 'main', isMainBranch: true,
    sonarCloudRepos, ruleEnrichmentMap,
  });

  if (journal) {
    await journal.recordUpload(sonarCloudMainBranch, result.ceTask?.id);
    await journal.markBranchCompleted(sonarCloudMainBranch, result.ceTask?.id);
  }

  return result;
}
