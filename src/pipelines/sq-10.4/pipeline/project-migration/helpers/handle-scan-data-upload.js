import { uploadScannerReport } from './upload-scanner-report.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Handle scanner report upload decision and execution.
 */
export async function handleScanDataUpload(project, scProjectKey, org, projectResult, ctx, projectScClient, only, shouldRun, isStepDone, recordStep) {
  const wantsScanData = shouldRun('scan-data') || shouldRun('scan-data-all-branches');
  if (wantsScanData) return await uploadScanData(project, scProjectKey, org, projectResult, ctx, only, isStepDone, recordStep);
  if (only) return await checkProjectExists(scProjectKey, projectResult, projectScClient);
  return false;
}

// -------- Helper Functions --------

async function uploadScanData(project, scProjectKey, org, projectResult, ctx, only, isStepDone, recordStep) {
  const wantsAllBranches = only?.includes('scan-data-all-branches');
  const syncAllBranchesOverride = only && !wantsAllBranches ? false : undefined;

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

async function checkProjectExists(scProjectKey, projectResult, projectScClient) {
  projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  if (await projectScClient.projectExists()) return true;
  logger.error(`Project "${scProjectKey}" does not exist in SonarCloud. Migrate scan-data first.`);
  projectResult.steps.push({ step: 'Project existence check', status: 'failed', error: `Project "${scProjectKey}" not found. Run --only scan-data first.`, durationMs: 0 });
  projectResult.errors.push(`Project "${scProjectKey}" not found in SonarCloud`);
  return false;
}
