import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import { buildFormData } from './build-form-data.js';
import { bufferFormAndPost } from './buffer-form-and-post.js';
import { handleSubmitResult } from './handle-submit-result.js';
import { findTaskFromActivity } from './find-task-from-activity.js';

// -------- Submit Report to SonarCloud Compute Engine (with retry) --------

export async function submitToComputeEngine(client, reportData, metadata) {
  const MAX_ATTEMPTS = 2;
  const ACTIVITY_CHECKS = 5;
  const ACTIVITY_CHECK_INTERVAL_MS = 3_000;
  const RESPONSE_TIMEOUT_MS = 60_000;
  const reportSizeMB = (reportData.length / (1024 * 1024)).toFixed(2);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      logger.warn(`No CE task found after ${ACTIVITY_CHECKS} activity checks. Re-submitting (attempt ${attempt}/${MAX_ATTEMPTS})...`);
    }
    logger.info(`Submitting to SonarCloud CE${attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ''}...`);

    const form = buildFormData(client, reportData, metadata);
    logger.info(`Uploading ${reportSizeMB} MB to /api/ce/submit ...`);
    const uploadStart = Date.now();

    const TIMEOUT = Symbol('timeout');
    let timeoutId;
    const timeoutPromise = new Promise(resolve => { timeoutId = setTimeout(() => resolve(TIMEOUT), RESPONSE_TIMEOUT_MS); });
    const result = await Promise.race([bufferFormAndPost(client, form), timeoutPromise]).catch(e => e);
    clearTimeout(timeoutId);

    if (result === TIMEOUT) {
      logger.warn(`No response after ${RESPONSE_TIMEOUT_MS / 1000}s — falling back to CE activity lookup`);
      const task = await findTaskFromActivity(client, uploadStart, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS);
      if (task) return task;
      if (attempt === MAX_ATTEMPTS) {
        throw new SonarCloudAPIError(
          `Report submission failed after ${MAX_ATTEMPTS} attempts. No CE task found after ${MAX_ATTEMPTS * ACTIVITY_CHECKS} activity checks.`,
        );
      }
      continue;
    }

    return handleSubmitResult(result, uploadStart);
  }
}
