import { upload } from './helpers/upload.js';
import { uploadAndWait } from './helpers/upload-and-wait.js';
import { checkExistingUpload } from './helpers/check-existing-upload.js';
import { validateReport } from './helpers/validate-report.js';
import { prepareReportData } from './helpers/prepare-report-data.js';
import { submitToComputeEngine } from './helpers/submit-to-compute-engine.js';
import { findTaskFromActivity } from './helpers/find-task-from-activity.js';

// -------- ReportUploader Factory + Class --------

export function createReportUploader(client) {
  return {
    client,
    upload: (encodedReport, metadata) => upload(client, encodedReport, metadata),
    uploadAndWait: (encodedReport, metadata, maxWait) => uploadAndWait(client, encodedReport, metadata, maxWait),
    checkExistingUpload: (sessionStartTime) => checkExistingUpload(client, sessionStartTime),
    validateReport: (encodedReport) => validateReport(encodedReport),
    prepareReportData: (encodedReport, metadata) => prepareReportData(encodedReport, metadata),
    submitToComputeEngine: (reportData, metadata) => submitToComputeEngine(client, reportData, metadata),
    _findTaskFromActivity: (uploadStart, maxChecks, interval) => findTaskFromActivity(client, uploadStart, maxChecks, interval),
  };
}

export class ReportUploader {
  constructor(client) {
    const instance = createReportUploader(client);
    Object.assign(this, instance);
  }
}
