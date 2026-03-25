import { ReportUploader } from '../../sonarcloud/uploader.js';
import { transferBranch } from './transfer-branch.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Transfer Main Branch --------

export async function transferMainBranch({ journal, sonarCloudMainBranch, sonarCloudClient, extractedData, sonarcloudConfig, sonarCloudProfiles, wait, sonarCloudRepos, ruleEnrichmentMap }) {
  const mainBranchCompleted = journal?.getBranchStatus(sonarCloudMainBranch) === 'completed';

  if (mainBranchCompleted) {
    logger.info(`Main branch '${sonarCloudMainBranch}' already completed in journal — skipping`);
    const ceTaskInfo = journal.getUploadedCeTask(sonarCloudMainBranch);
    return {
      stats: { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0 },
      ceTask: ceTaskInfo ? { id: ceTaskInfo.taskId } : null,
    };
  }

  if (journal) await journal.startBranch(sonarCloudMainBranch);

  const uploader = new ReportUploader(sonarCloudClient);
  const existingUpload = journal ? await uploader.checkExistingUpload(journal.sessionStartTime) : null;

  if (existingUpload) {
    const result = {
      stats: { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0 },
      ceTask: existingUpload,
    };
    if (journal) {
      await journal.recordUpload(sonarCloudMainBranch, result.ceTask?.id);
      await journal.markBranchCompleted(sonarCloudMainBranch, result.ceTask?.id);
    }
    return result;
  }

  const result = await transferBranch({
    extractedData, sonarcloudConfig, sonarCloudProfiles,
    branchName: sonarCloudMainBranch, referenceBranchName: sonarCloudMainBranch,
    wait, sonarCloudClient, label: 'main', isMainBranch: true, sonarCloudRepos, ruleEnrichmentMap,
  });

  if (journal) {
    await journal.recordUpload(sonarCloudMainBranch, result.ceTask?.id);
    await journal.markBranchCompleted(sonarCloudMainBranch, result.ceTask?.id);
  }

  return result;
}
