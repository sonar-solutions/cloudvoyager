import logger from '../../../../../shared/utils/logger.js';
import { uploadReport } from './upload-report.js';

// -------- Upload and Wait for Analysis --------

export async function uploadAndWait(client, encodedReport, metadata, maxWaitSeconds = 300) {
  logger.info('Starting upload and wait for analysis...');
  const ceTask = await uploadReport(client, encodedReport, metadata);
  const result = await client.waitForAnalysis(ceTask.id, maxWaitSeconds);
  logger.info('Analysis completed successfully');
  return result;
}
