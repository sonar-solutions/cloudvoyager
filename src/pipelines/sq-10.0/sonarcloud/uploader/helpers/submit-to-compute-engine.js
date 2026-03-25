import logger from '../../../../../shared/utils/logger.js';
import { buildFormData } from './build-form-data.js';
import { handleSubmitResult } from './handle-submit-result.js';

// -------- Submit Report to SonarCloud Compute Engine --------

const MAX_ATTEMPTS = 2;
const ACTIVITY_CHECKS = 5;
const ACTIVITY_CHECK_INTERVAL_MS = 3_000;
const RESPONSE_TIMEOUT_MS = 60_000;

export async function submitToComputeEngine(client, reportData, metadata) {
  const reportSizeMB = (reportData.length / (1024 * 1024)).toFixed(2);
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) logger.warn(`Re-submitting (attempt ${attempt}/${MAX_ATTEMPTS})...`);
    const { formBuffer, formHeaders } = await buildFormData(client, reportData, metadata);
    logger.info(`Uploading ${reportSizeMB} MB to /api/ce/submit ...`);
    const uploadStart = Date.now();
    const postPromise = client.client.post('/api/ce/submit', formBuffer, {
      headers: { ...formHeaders, 'content-length': formBuffer.length },
      maxBodyLength: Infinity, maxContentLength: Infinity, timeout: 300_000,
    });
    const TIMEOUT = Symbol('timeout');
    let timeoutId;
    const timeoutPromise = new Promise(resolve => { timeoutId = setTimeout(() => resolve(TIMEOUT), RESPONSE_TIMEOUT_MS); });
    const result = await Promise.race([postPromise, timeoutPromise]).catch(e => e);
    clearTimeout(timeoutId);
    const ceTask = await handleSubmitResult({ result, TIMEOUT, client, uploadStart, attempt, MAX_ATTEMPTS, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS });
    if (ceTask) return ceTask;
  }
}
