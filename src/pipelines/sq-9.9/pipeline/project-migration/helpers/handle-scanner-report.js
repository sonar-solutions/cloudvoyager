import { uploadScannerReport } from './upload-scanner-report.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Handle Scanner Report Upload Decision --------

export async function handleScannerReport({ project, scProjectKey, org, projectResult, ctx, projectScClient, shouldRun, only, isStepDone, recordStep }) {
  const wantsScanData = shouldRun('scan-data') || shouldRun('scan-data-all-branches');

  if (wantsScanData) {
    let syncAllBranchesOverride;
    if (only) { syncAllBranchesOverride = only.includes('scan-data-all-branches') ? undefined : false; }
    if (isStepDone('upload_scanner_report')) {
      logger.info(`[${project.key}] Scanner report upload — already completed, skipping`);
      projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
      return true;
    }
    logger.info(`[${project.key}] Starting scanner report upload`);
    const ok = await uploadScannerReport(project, scProjectKey, org, projectResult, ctx, syncAllBranchesOverride);
    if (ok) { logger.info(`[${project.key}] Scanner report upload complete`); await recordStep('upload_scanner_report'); }
    return ok;
  }

  if (only) {
    projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    const exists = await projectScClient.projectExists();
    if (!exists) {
      logger.error(`Project "${scProjectKey}" does not exist in SonarCloud. Run --only scan-data first.`);
      projectResult.errors.push(`Project "${scProjectKey}" not found in SonarCloud`);
      return false;
    }
    return true;
  }

  return false;
}
