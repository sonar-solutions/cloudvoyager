import FormData from 'form-data';
import logger from '../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../shared/utils/errors.js';

/**
 * Submit report to SonarCloud Compute Engine.
 *
 * Retry mechanism:
 *   1. Submit the report zip via POST /api/ce/submit
 *   2. If the server does not respond, check /api/ce/activity 5 times
 *   3. If no CE task appears, re-submit the report (second attempt)
 *   4. After the second submission, check /api/ce/activity 5 more times
 *   5. If still no CE task, throw a descriptive error
 *
 * @param {object} client - SonarCloud API client
 * @param {Buffer} reportData - Zip buffer of the scanner report
 * @param {object} metadata - Analysis metadata
 * @returns {Promise<object>} CE task object with id and status
 */
export async function submitToComputeEngine(client, reportData, metadata) {
  const MAX_ATTEMPTS = 2;
  const ACTIVITY_CHECKS = 5;
  const ACTIVITY_CHECK_INTERVAL_MS = 3_000;
  const RESPONSE_TIMEOUT_MS = 60_000;

  const reportSizeMB = (reportData.length / (1024 * 1024)).toFixed(2);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      logger.warn(
        `No CE task found after ${ACTIVITY_CHECKS} activity checks on attempt ${attempt - 1}. ` +
        `Re-submitting report (attempt ${attempt}/${MAX_ATTEMPTS})...`
      );
    }

    logger.info(`Submitting to SonarCloud Compute Engine${attempt > 1 ? ` (attempt ${attempt}/${MAX_ATTEMPTS})` : ''}...`);

    const form = new FormData();

    form.append('report', reportData, {
      contentType: 'application/zip',
      filename: 'scanner-report.zip'
    });

    form.append('projectKey', client.projectKey);
    form.append('organization', client.organization);

    // For non-main branches, send branch characteristics so the CE endpoint
    // routes the analysis to the correct branch instead of defaulting to main.
    // SonarCloud expects branchType=LONG (long-lived branch) — sending "BRANCH"
    // returns 400 "Unsupported branch type", and omitting branchType returns 400
    // "One and only one of branchType and pullRequest must be specified".
    if (metadata.branchName) {
      form.append('characteristic', `branch=${metadata.branchName}`);
      form.append('characteristic', 'branchType=LONG');
      logger.info(`Branch characteristics: branch=${metadata.branchName}, branchType=LONG`);
    }

    const analysisProperties = [
      `sonar.projectKey=${client.projectKey}`,
      `sonar.organization=${client.organization}`,
      `sonar.projectVersion=${metadata.version || '1.0.0'}`,
      'sonar.sourceEncoding=UTF-8'
    ];

    form.append('properties', analysisProperties.join('\n'));

    logger.info(`Uploading ${reportSizeMB} MB to /api/ce/submit ...`);

    const uploadStart = Date.now();

    // Buffer the form data before sending. Sending a complete Buffer (rather
    // than streaming) avoids runtime-specific issues: Bun's HTTP client does
    // not always flush small streamed payloads properly, causing the server
    // to never acknowledge the submission. Buffering first ensures the full
    // multipart body is available upfront.
    const formHeaders = form.getHeaders();
    const formBuffer = await new Promise((resolve, reject) => {
      const chunks = [];
      form.on('data', chunk => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
      form.on('end', () => resolve(Buffer.concat(chunks)));
      form.on('error', reject);
      form.resume();
    });

    const postPromise = client.client.post('/api/ce/submit', formBuffer, {
      headers: {
        ...formHeaders,
        'content-length': formBuffer.length,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 300_000,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total) {
          const pct = Math.round((progressEvent.loaded / progressEvent.total) * 100);
          logger.debug(`Upload progress: ${pct}% (${(progressEvent.loaded / 1024).toFixed(0)} KB / ${(progressEvent.total / 1024).toFixed(0)} KB)`);
        } else {
          logger.debug(`Upload progress: ${(progressEvent.loaded / 1024).toFixed(0)} KB sent`);
        }
      }
    });

    const TIMEOUT = Symbol('timeout');
    let timeoutId;
    const timeoutPromise = new Promise(resolve => {
      timeoutId = setTimeout(() => resolve(TIMEOUT), RESPONSE_TIMEOUT_MS);
    });

    const result = await Promise.race([postPromise, timeoutPromise]).catch(error => error);
    clearTimeout(timeoutId);

    if (result === TIMEOUT) {
      logger.warn(`No response from /api/ce/submit after ${RESPONSE_TIMEOUT_MS / 1000}s — falling back to CE activity lookup`);
      const task = await findTaskFromActivity(client, uploadStart, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS);
      if (task) {
        return task;
      }

      // No task found — retry on next iteration or fail
      if (attempt === MAX_ATTEMPTS) {
        throw new SonarCloudAPIError(
          `Report submission failed after ${MAX_ATTEMPTS} attempts. ` +
          'Mechanism followed: For each attempt, the report zip was uploaded to /api/ce/submit, ' +
          'the upload completed successfully but no response was received from the server. ' +
          `After each upload, /api/ce/activity was checked ${ACTIVITY_CHECKS} times ` +
          `(${ACTIVITY_CHECK_INTERVAL_MS / 1000}s apart) for a matching CE task, but none was found. ` +
          `Total activity checks across all attempts: ${MAX_ATTEMPTS * ACTIVITY_CHECKS}. ` +
          'The SonarCloud server did not acknowledge or process the report.'
        );
      }
      continue;
    }

    // Real HTTP error
    if (result instanceof Error) {
      if (result.response) {
        const { status, data } = result.response;
        throw new SonarCloudAPIError(
          `Failed to submit to CE (${status}): ${data.errors?.[0]?.msg || data.message || 'Unknown error'}`,
          status
        );
      }
      throw result;
    }

    // Successful response
    const response = result;
    const ceTask = response.data.ceTask || response.data.task || {
      id: response.data.taskId || 'unknown'
    };

    const totalSeconds = ((Date.now() - uploadStart) / 1000).toFixed(1);
    logger.info(`Report submitted to Compute Engine (took ${totalSeconds}s)`);
    return ceTask;
  }
}

/**
 * Fallback: find the CE task via /api/ce/activity when the submit response is lost.
 * Polls exactly `maxChecks` times. Returns the task object if found, or null.
 *
 * @param {object} client - SonarCloud API client
 * @param {number} uploadStart - Timestamp of when the upload started
 * @param {number} maxChecks - Maximum number of activity checks
 * @param {number} checkIntervalMs - Interval between checks in milliseconds
 * @returns {Promise<object|null>} CE task object or null
 */
export async function findTaskFromActivity(client, uploadStart, maxChecks = 5, checkIntervalMs = 3000) {
  logger.info(`Looking up CE task from activity API (${maxChecks} checks, ${checkIntervalMs / 1000}s interval)...`);

  for (let check = 1; check <= maxChecks; check++) {
    const task = await client.getMostRecentCeTask();
    if (task) {
      // Accept the task if it was submitted around or after our upload started
      const taskSubmittedAt = task.submittedAt ? new Date(task.submittedAt).getTime() : 0;
      if (taskSubmittedAt >= uploadStart - 30_000) {
        const totalSeconds = ((Date.now() - uploadStart) / 1000).toFixed(1);
        logger.info(`Found CE task ${task.id} (status: ${task.status}) via activity lookup on check ${check}/${maxChecks} (took ${totalSeconds}s)`);
        return { id: task.id, status: task.status };
      }
    }
    logger.debug(`CE activity check ${check}/${maxChecks}: no matching task found`);
    if (check < maxChecks) {
      await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
    }
  }

  const totalSeconds = ((Date.now() - uploadStart) / 1000).toFixed(1);
  logger.warn(`No CE task found after ${maxChecks} activity checks (${totalSeconds}s elapsed)`);
  return null;
}
