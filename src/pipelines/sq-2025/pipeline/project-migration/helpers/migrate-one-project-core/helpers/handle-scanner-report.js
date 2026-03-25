import logger from '../../../../../../../shared/utils/logger.js';
import { uploadScannerReport } from './upload-scanner-report.js';

// -------- Handle Scanner Report --------

/** Determine whether to upload scanner report or check project existence. */
export async function handleScannerReport(project, scProjectKey, org, projectResult, ctx, shouldRun, only, isStepDone, recordStep, projectScClient) {
  const wantsScanData = shouldRun('scan-data') || shouldRun('scan-data-all-branches');
  if (!wantsScanData && !only) return false;

  if (wantsScanData) {
    return await uploadScannerReport(project, scProjectKey, org, projectResult, ctx, only, isStepDone, recordStep);
  }

  projectResult.steps.push({ step: 'Upload scanner report', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  const exists = await projectScClient.projectExists();
  if (exists) return true;

  logger.error(`Project "${scProjectKey}" does not exist in SonarCloud. Run --only scan-data first.`);
  projectResult.steps.push({ step: 'Project existence check', status: 'failed', error: `Project "${scProjectKey}" not found`, durationMs: 0 });
  projectResult.errors.push(`Project "${scProjectKey}" not found in SonarCloud`);
  return false;
}
