import { uploadReport } from './helpers/upload-report.js';
import { uploadAndWait } from './helpers/upload-and-wait.js';
import { checkExistingUpload } from './helpers/check-existing-upload.js';
import { prepareReportData } from './helpers/prepare-report-data.js';
import { submitToComputeEngine } from './helpers/submit-to-compute-engine.js';
import { validateReport } from './helpers/validate-report.js';

// -------- Factory Function --------

export function createReportUploader(client) {
  return {
    client,
    upload: (encodedReport, metadata) => uploadReport(client, encodedReport, metadata),
    uploadAndWait: (encodedReport, metadata, maxWait) => uploadAndWait(client, encodedReport, metadata, maxWait),
    checkExistingUpload: (sessionStartTime) => checkExistingUpload(client, sessionStartTime),
    prepareReportData: (encodedReport, metadata) => prepareReportData(encodedReport, metadata),
    submitToComputeEngine: (reportData, metadata) => submitToComputeEngine(client, reportData, metadata),
    validateReport: (encodedReport) => validateReport(encodedReport),
  };
}

// -------- Class Wrapper (backward compat) --------

export class ReportUploader {
  constructor(client) {
    Object.assign(this, createReportUploader(client));
  }
}
