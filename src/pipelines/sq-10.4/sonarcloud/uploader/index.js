import { createReportUploader } from './helpers/create-report-uploader.js';

// -------- Factory Function (primary export) --------

export { createReportUploader };

// -------- Thin Class Wrapper (backward compatibility) --------

/**
 * ReportUploader class — thin wrapper around createReportUploader factory.
 */
export class ReportUploader {
  constructor(client) {
    const instance = createReportUploader(client);
    this.client = client;
    this._instance = instance;
  }

  upload(encodedReport, metadata) {
    return this._instance.upload(encodedReport, metadata);
  }

  prepareReportData(encodedReport, metadata) {
    return this._instance.prepareReportData(encodedReport, metadata);
  }

  submitToComputeEngine(reportData, metadata) {
    return this._instance.submitToComputeEngine(reportData, metadata);
  }

  uploadAndWait(encodedReport, metadata, maxWaitSeconds) {
    return this._instance.uploadAndWait(encodedReport, metadata, maxWaitSeconds);
  }

  checkExistingUpload(sessionStartTime) {
    return this._instance.checkExistingUpload(sessionStartTime);
  }

  validateReport(encodedReport) {
    return this._instance.validateReport(encodedReport);
  }

  _findTaskFromActivity(startTime, maxChecks, intervalSec) {
    return this._instance._findTaskFromActivity(startTime, maxChecks, intervalSec);
  }
}
