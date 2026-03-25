import logger from '../../../../../shared/utils/logger.js';
import { buildFormData } from './build-form-data.js';
import { postReport } from './post-report.js';
import { handleSubmitResult } from './handle-submit-result.js';
import { findTaskFromActivity } from './find-task-from-activity.js';

// -------- Submit To Compute Engine --------

/** Submit report to SonarCloud CE with retry and activity fallback. */
export async function submitToComputeEngine(client, reportData, metadata) {
  const MAX_ATTEMPTS = 2;
  const ACTIVITY_CHECKS = 5;
  const ACTIVITY_CHECK_INTERVAL_MS = 3_000;
  const RESPONSE_TIMEOUT_MS = 60_000;
  const reportSizeMB = (reportData.length / (1024 * 1024)).toFixed(2);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) logger.warn(`No CE task found — re-submitting report (attempt ${attempt}/${MAX_ATTEMPTS})...`);
    logger.info(`Submitting to SonarCloud Compute Engine${attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ''}...`);
    logger.info(`Uploading ${reportSizeMB} MB to /api/ce/submit ...`);

    const uploadStart = Date.now();
    const { formHeaders, formBuffer } = await buildFormData(client, reportData, metadata);
    const { result, TIMEOUT } = await postReport(client, formHeaders, formBuffer, RESPONSE_TIMEOUT_MS);

    const outcome = await handleSubmitResult(result, TIMEOUT, client, uploadStart, attempt, MAX_ATTEMPTS, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS, findTaskFromActivity);
    if (outcome !== 'retry') return outcome;
  }
}
