import logger from '../../../../../shared/utils/logger.js';
import { prepareReportData } from './prepare-report-data.js';
import { submitToComputeEngine } from './submit-to-compute-engine.js';
import { checkExistingUpload } from './check-existing-upload.js';
import { validateReport } from './validate-report.js';

// -------- Create Report Uploader --------

/** Factory function that creates a ReportUploader instance. */
export function createReportUploader(client) {
  return {
    client,

    async upload(encodedReport, metadata) {
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

    async uploadAndWait(encodedReport, metadata, maxWaitSeconds = 300) {
      logger.info('Starting upload and wait for analysis...');
      const ceTask = await this.upload(encodedReport, metadata);
      const result = await client.waitForAnalysis(ceTask.id, maxWaitSeconds);
      logger.info('Analysis completed successfully');
      return result;
    },

    checkExistingUpload: (sessionStartTime) => checkExistingUpload(client, sessionStartTime),

    validateReport: (encodedReport) => validateReport(encodedReport),

    prepareReportData: (encodedReport) => prepareReportData(encodedReport),
  };
}
