import { ReportUploader } from '../../../../sonarcloud/uploader.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Upload Report --------

/** Upload an encoded report to SonarCloud. */
export async function uploadReport(encodedReport, scConfig, scClient, branchName, isMainBranch, wait, label) {
  logger.info(`[${label}] Uploading to SonarCloud...`);
  const uploader = new ReportUploader(scClient);
  const metadata = {
    projectKey: scConfig.projectKey,
    organization: scConfig.organization,
    version: '1.0.0',
    ...(!isMainBranch && branchName ? { branchName } : {}),
  };

  if (wait) {
    const ceTask = await uploader.uploadAndWait(encodedReport, metadata);
    logger.info(`[${label}] Analysis completed successfully`);
    return ceTask;
  }
  const ceTask = await uploader.upload(encodedReport, metadata);
  logger.info(`[${label}] Upload complete. CE Task ID: ${ceTask.id}`);
  return ceTask;
}
