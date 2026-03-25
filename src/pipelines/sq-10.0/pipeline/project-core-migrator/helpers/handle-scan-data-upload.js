import logger from '../../../../../shared/utils/logger.js';
import { uploadScannerReport } from './upload-scanner-report.js';

// -------- Handle Scan Data Upload --------

export async function handleScanDataUpload(project, scProjectKey, org, projectResult, ctx, only, isStepDone, recordStep) {
  const wantsScanData = (!only) || only.includes('scan-data') || only.includes('scan-data-all-branches');

  if (!wantsScanData && only) {
    projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    return null; // caller must check project existence separately
  }

  if (!wantsScanData) return null;

  let syncAllBranchesOverride;
  if (only) {
    syncAllBranchesOverride = only.includes('scan-data-all-branches') ? undefined : false;
  }

  if (isStepDone('upload_scanner_report')) {
    logger.info(`[${project.key}] Scanner report upload — already completed, skipping`);
    projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    return true;
  }

  logger.info(`[${project.key}] Starting scanner report upload`);
  const ok = await uploadScannerReport(project, scProjectKey, org, projectResult, ctx, syncAllBranchesOverride);
  if (ok) {
    logger.info(`[${project.key}] Scanner report upload complete`);
    await recordStep('upload_scanner_report');
  }
  return ok;
}
