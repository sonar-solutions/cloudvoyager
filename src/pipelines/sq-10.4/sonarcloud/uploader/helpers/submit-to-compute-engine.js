import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import { postWithTimeout } from './post-with-timeout.js';
import { findTaskFromActivity } from './find-task-from-activity.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Submit report to SonarCloud Compute Engine with retry.
 *
 * @param {object} client - SonarCloud API client
 * @param {Buffer} reportData - Zip buffer
 * @param {object} metadata - Analysis metadata
 * @returns {Promise<object>} CE task object
 */
export async function submitToComputeEngine(client, reportData, metadata) {
  const MAX_ATTEMPTS = 2;
  const ACTIVITY_CHECKS = 5;
  const ACTIVITY_CHECK_INTERVAL_MS = 3_000;
  const reportSizeMB = (reportData.length / (1024 * 1024)).toFixed(2);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) logger.warn(`No CE task found after ${ACTIVITY_CHECKS} checks. Re-submitting (attempt ${attempt}/${MAX_ATTEMPTS})...`);

    logger.info(`Submitting to SonarCloud CE${attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ''}...`);
    logger.info(`Uploading ${reportSizeMB} MB to /api/ce/submit ...`);

    const uploadStart = Date.now();
    const result = await postWithTimeout(client, reportData, metadata);

    if (result.timeout) {
      const task = await findTaskFromActivity(client, uploadStart, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS);
      if (task) return task;
      if (attempt === MAX_ATTEMPTS) throw new SonarCloudAPIError(`Report submission failed after ${MAX_ATTEMPTS} attempts. Server did not acknowledge the report.`);
      continue;
    }

    if (result.error) {
      if (result.error.response) {
        const { status, data } = result.error.response;
        throw new SonarCloudAPIError(`Failed to submit to CE (${status}): ${data.errors?.[0]?.msg || data.message || 'Unknown error'}`, status);
      }
      throw result.error;
    }

    const ceTask = result.response.data.ceTask || result.response.data.task || { id: result.response.data.taskId || 'unknown' };
    logger.info(`Report submitted to Compute Engine (took ${((Date.now() - uploadStart) / 1000).toFixed(1)}s)`);
    return ceTask;
  }
}
