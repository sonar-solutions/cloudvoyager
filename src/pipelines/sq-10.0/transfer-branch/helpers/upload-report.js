// -------- Upload Report --------

import logger from '../../../../shared/utils/logger.js';
import { ReportUploader } from '../../sonarcloud/uploader.js';

export async function uploadReport({ sonarCloudClient, encodedReport, metadata, wait, label }) {
  logger.info(`[${label}] Uploading to SonarCloud...`);
  const uploader = new ReportUploader(sonarCloudClient);

  if (wait) {
    const ceTask = await uploader.uploadAndWait(encodedReport, metadata);
    logger.info(`[${label}] Analysis completed successfully`);
    return ceTask;
  }

  const ceTask = await uploader.upload(encodedReport, metadata);
  logger.info(`[${label}] Upload complete. CE Task ID: ${ceTask.id}`);
  return ceTask;
}
