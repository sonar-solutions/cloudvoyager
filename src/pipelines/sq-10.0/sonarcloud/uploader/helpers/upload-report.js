import logger from '../../../../../shared/utils/logger.js';
import { prepareReportData } from './prepare-report-data.js';
import { submitToComputeEngine } from './submit-to-compute-engine.js';

// -------- Upload Report --------

export async function uploadReport(client, encodedReport, metadata) {
  logger.info('Uploading report to SonarCloud...');
  try {
    await client.ensureProject();
    const reportData = prepareReportData(encodedReport, metadata);
    const ceTask = await submitToComputeEngine(client, reportData, metadata);
    logger.info(`Report uploaded successfully (CE Task: ${ceTask.id})`);
    return ceTask;
  } catch (error) {
    logger.error(`Failed to upload report: ${error.message}`);
    throw error;
  }
}
