import { ReportUploader } from '../../../../sonarcloud/uploader.js';
import { transferBranch } from '../../transfer-branch.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Execute Main Branch Transfer --------

/** Execute the actual main branch transfer (build, encode, upload). */
export async function executeMainBranchTransfer(opts) {
  const { journal, sonarCloudMainBranch, sonarCloudClient, extractedData, sonarcloudConfig, sonarCloudProfiles, wait, sonarCloudRepos, ruleEnrichmentMap } = opts;

  if (journal) await journal.startBranch(sonarCloudMainBranch);

  const uploader = new ReportUploader(sonarCloudClient);
  const existingUpload = journal ? await uploader.checkExistingUpload(journal.sessionStartTime) : null;

  let result;
  if (existingUpload) {
    result = {
      stats: { issuesTransferred: 0, hotspotsTransferred: 0, componentsTransferred: 0, sourcesTransferred: 0, linesOfCode: 0 },
      ceTask: existingUpload,
    };
  } else {
    result = await transferBranch({
      extractedData, sonarcloudConfig, sonarCloudProfiles,
      branchName: sonarCloudMainBranch, referenceBranchName: sonarCloudMainBranch,
      wait, sonarCloudClient, label: 'main', isMainBranch: true,
      sonarCloudRepos, ruleEnrichmentMap,
    });
  }

  if (journal) {
    await journal.recordUpload(sonarCloudMainBranch, result.ceTask?.id);
    await journal.markBranchCompleted(sonarCloudMainBranch, result.ceTask?.id);
  }

  return result;
}
