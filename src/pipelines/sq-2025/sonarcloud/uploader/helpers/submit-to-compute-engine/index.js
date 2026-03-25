import logger from '../../../../../../shared/utils/logger.js';
import { buildFormData } from '../build-form-data.js';
import { postReportToApi } from '../post-report-to-api.js';
import { handleTimeoutResult } from './helpers/handle-timeout-result.js';
import { handleErrorResult } from './helpers/handle-error-result.js';

// -------- Submit to Compute Engine --------

const MAX_ATTEMPTS = 2;
const ACTIVITY_CHECKS = 5;
const ACTIVITY_CHECK_INTERVAL_MS = 3_000;

/** Submit report to SonarCloud CE with retry and activity fallback. */
export async function submitToComputeEngine(client, reportData, metadata) {
  const reportSizeMB = (reportData.length / (1024 * 1024)).toFixed(2);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) logger.warn(`No CE task found after activity checks. Re-submitting (attempt ${attempt}/${MAX_ATTEMPTS})...`);
    logger.info(`Submitting to SonarCloud CE${attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ''}...`);

    const { formHeaders, formBuffer } = await buildFormData(client, reportData, metadata);
    logger.info(`Uploading ${reportSizeMB} MB to /api/ce/submit ...`);

    const uploadStart = Date.now();
    const result = await postReportToApi(client, formHeaders, formBuffer);

    if (result === 'TIMEOUT') {
      const task = await handleTimeoutResult(client, uploadStart, attempt, MAX_ATTEMPTS, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS);
      if (task) return task;
      continue;
    }

    if (result instanceof Error) handleErrorResult(result);

    const ceTask = result.data.ceTask || result.data.task || { id: result.data.taskId || 'unknown' };
    logger.info(`Report submitted to Compute Engine (took ${((Date.now() - uploadStart) / 1000).toFixed(1)}s)`);
    return ceTask;
  }
}
