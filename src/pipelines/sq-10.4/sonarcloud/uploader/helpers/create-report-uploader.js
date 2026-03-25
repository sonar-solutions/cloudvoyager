import { prepareReportData } from './prepare-report-data.js';
import { submitToComputeEngine } from './submit-to-compute-engine.js';
import { findTaskFromActivity } from './find-task-from-activity.js';
import { checkExistingUpload } from './check-existing-upload.js';
import { validateReport } from './validate-report.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Create a ReportUploader instance (factory function).
 *
 * @param {object} client - SonarCloud API client
 * @returns {object} ReportUploader instance
 */
export function createReportUploader(client) {
  return {
    client,
    upload: async (encodedReport, metadata) => {
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
    },
    uploadAndWait: async (encodedReport, metadata, maxWaitSeconds = 300) => {
      logger.info('Starting upload and wait for analysis...');
      const uploader = createReportUploader(client);
      const ceTask = await uploader.upload(encodedReport, metadata);
      const result = await client.waitForAnalysis(ceTask.id, maxWaitSeconds);
      logger.info('Analysis completed successfully');
      return result;
    },
    checkExistingUpload: (sessionStartTime) => checkExistingUpload(client, sessionStartTime),
    validateReport,
    prepareReportData,
    submitToComputeEngine: (reportData, metadata) => submitToComputeEngine(client, reportData, metadata),
  };
}
