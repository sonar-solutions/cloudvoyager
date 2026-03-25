import logger from '../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../shared/utils/errors.js';
import { buildFormData } from './helpers/build-form-data.js';
import { postReport } from './helpers/post-report.js';
import { findTaskFromActivity } from './helpers/find-task-from-activity.js';
import { handleSubmitResult } from './helpers/handle-submit-result.js';

// -------- Re-export --------

export { findTaskFromActivity } from './helpers/find-task-from-activity.js';

// -------- Submit to Compute Engine --------

export async function submitToComputeEngine(client, reportData, metadata) {
  const MAX_ATTEMPTS = 2;
  const ACTIVITY_CHECKS = 5;
  const ACTIVITY_CHECK_INTERVAL_MS = 3_000;
  const RESPONSE_TIMEOUT_MS = 60_000;

  const reportSizeMB = (reportData.length / (1024 * 1024)).toFixed(2);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) logger.warn(`No CE task found after ${ACTIVITY_CHECKS} activity checks on attempt ${attempt - 1}. Re-submitting report (attempt ${attempt}/${MAX_ATTEMPTS})...`);
    logger.info(`Submitting to SonarCloud Compute Engine${attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ''}...`);
    logger.info(`Uploading ${reportSizeMB} MB to /api/ce/submit ...`);

    const { formHeaders, formBuffer } = await buildFormData(client, reportData, metadata);
    const uploadStart = Date.now();
    const { result, TIMEOUT } = await postReport(client, formBuffer, formHeaders, RESPONSE_TIMEOUT_MS);

    if (result === TIMEOUT) {
      logger.warn(`No response from /api/ce/submit after ${RESPONSE_TIMEOUT_MS / 1000}s — falling back to CE activity lookup`);
      const task = await findTaskFromActivity(client, uploadStart, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS);
      if (task) return task;
      if (attempt === MAX_ATTEMPTS) {
        throw new SonarCloudAPIError(`Report submission failed after ${MAX_ATTEMPTS} attempts. No CE task found after all activity checks.`);
      }
      continue;
    }

    return handleSubmitResult(result, uploadStart);
  }
}
