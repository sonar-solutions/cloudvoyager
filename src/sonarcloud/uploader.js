import FormData from 'form-data';
import AdmZip from 'adm-zip';
import logger from '../utils/logger.js';
import { SonarCloudAPIError } from '../utils/errors.js';

/**
 * Upload scanner report to SonarCloud
 */
export class ReportUploader {
  constructor(client) {
    this.client = client;
  }

  /**
   * Upload encoded report to SonarCloud CE endpoint
   * @param {object} encodedReport - Encoded protobuf report
   * @param {object} metadata - Analysis metadata
   * @returns {Promise<object>} Upload response with CE task ID
   */
  async upload(encodedReport, metadata) {
    logger.info('Uploading report to SonarCloud...');

    try {
      // Ensure project exists
      await this.client.ensureProject();

      // Prepare the report for upload
      const reportData = this.prepareReportData(encodedReport, metadata);

      // Submit to CE endpoint
      const ceTask = await this.submitToComputeEngine(reportData, metadata);

      logger.info(`Report uploaded successfully (CE Task: ${ceTask.id})`);

      return ceTask;

    } catch (error) {
      logger.error(`Failed to upload report: ${error.message}`);
      throw error;
    }
  }

  /**
   * Prepare report data for upload - creates a zip archive matching SonarScanner format
   */
  prepareReportData(encodedReport, _metadata) {
    logger.debug('Preparing report data as scanner report zip...');

    const zip = new AdmZip();

    // Add metadata.pb (single message, NOT length-delimited)
    zip.addFile('metadata.pb', Buffer.from(encodedReport.metadata));
    logger.debug('Added metadata.pb to report');

    // Add component files (component-{ref}.pb) - one file per component
    encodedReport.components.forEach((componentBuffer, index) => {
      const ref = index + 1;
      zip.addFile(`component-${ref}.pb`, Buffer.from(componentBuffer));
    });
    logger.debug(`Added ${encodedReport.components.length} component files`);

    // Add issues files (issues-{ref}.pb) - each is a Buffer of length-delimited Issue messages
    let issueFileCount = 0;
    encodedReport.issues.forEach((issueBuffer, componentRef) => {
      zip.addFile(`issues-${componentRef}.pb`, Buffer.from(issueBuffer));
      issueFileCount++;
    });
    logger.debug(`Added ${issueFileCount} issue files`);

    // Add measures files (measures-{ref}.pb) - each is a Buffer of length-delimited Measure messages
    let measureFileCount = 0;
    encodedReport.measures.forEach((measureBuffer, componentRef) => {
      zip.addFile(`measures-${componentRef}.pb`, Buffer.from(measureBuffer));
      measureFileCount++;
    });
    logger.debug(`Added ${measureFileCount} measure files`);

    // Add source files as plain text (source-{ref}.txt)
    if (encodedReport.sourceFilesText && encodedReport.sourceFilesText.length > 0) {
      encodedReport.sourceFilesText.forEach((sourceFile) => {
        const ref = sourceFile.componentRef;
        zip.addFile(`source-${ref}.txt`, Buffer.from(sourceFile.text, 'utf-8'));
      });
      logger.debug(`Added ${encodedReport.sourceFilesText.length} source text files`);
    }

    // Add active rules file (activerules.pb) - single Buffer of length-delimited ActiveRule messages
    if (encodedReport.activeRules && encodedReport.activeRules.length > 0) {
      zip.addFile('activerules.pb', Buffer.from(encodedReport.activeRules));
      logger.debug(`Added activerules.pb (${encodedReport.activeRules.length} bytes)`);
    }

    // Add changeset files (changesets-{ref}.pb) - single Changesets message each
    let changesetFileCount = 0;
    if (encodedReport.changesets && encodedReport.changesets.size > 0) {
      encodedReport.changesets.forEach((changesetBuffer, componentRef) => {
        zip.addFile(`changesets-${componentRef}.pb`, Buffer.from(changesetBuffer));
        changesetFileCount++;
      });
      logger.debug(`Added ${changesetFileCount} changeset files`);
    }

    // Add context-props.pb - empty file (matches real scanner behavior)
    zip.addFile('context-props.pb', Buffer.alloc(0));
    logger.debug('Added context-props.pb (empty)');

    // Return the zip as a buffer
    const reportBuffer = zip.toBuffer();
    logger.info(`Scanner report zip created: ${reportBuffer.length} bytes`);

    return reportBuffer;
  }

  /**
   * Submit report to SonarCloud Compute Engine.
   *
   * Retry mechanism:
   *   1. Submit the report zip via POST /api/ce/submit
   *   2. If the server does not respond, check /api/ce/activity 5 times
   *   3. If no CE task appears, re-submit the report (second attempt)
   *   4. After the second submission, check /api/ce/activity 5 more times
   *   5. If still no CE task, throw a descriptive error
   */
  async submitToComputeEngine(reportData, metadata) {
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

      form.append('projectKey', this.client.projectKey);
      form.append('organization', this.client.organization);

      const analysisProperties = [
        `sonar.projectKey=${this.client.projectKey}`,
        `sonar.organization=${this.client.organization}`,
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

      const postPromise = this.client.client.post('/api/ce/submit', formBuffer, {
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
      const timeoutPromise = new Promise(resolve =>
        setTimeout(() => resolve(TIMEOUT), RESPONSE_TIMEOUT_MS)
      );

      const result = await Promise.race([postPromise, timeoutPromise]).catch(error => error);

      if (result === TIMEOUT) {
        logger.warn(`No response from /api/ce/submit after ${RESPONSE_TIMEOUT_MS / 1000}s — falling back to CE activity lookup`);
        const task = await this._findTaskFromActivity(uploadStart, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS);
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
   */
  async _findTaskFromActivity(uploadStart, maxChecks = 5, checkIntervalMs = 3000) {
    logger.info(`Looking up CE task from activity API (${maxChecks} checks, ${checkIntervalMs / 1000}s interval)...`);

    for (let check = 1; check <= maxChecks; check++) {
      const task = await this.client.getMostRecentCeTask();
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

  /**
   * Upload and wait for analysis to complete
   */
  async uploadAndWait(encodedReport, metadata, maxWaitSeconds = 300) {
    logger.info('Starting upload and wait for analysis...');

    const ceTask = await this.upload(encodedReport, metadata);
    const result = await this.client.waitForAnalysis(ceTask.id, maxWaitSeconds);

    logger.info('Analysis completed successfully');

    return result;
  }

  /**
   * Validate report before upload
   */
  validateReport(encodedReport) {
    logger.debug('Validating report before upload...');

    if (!encodedReport.metadata) {
      throw new SonarCloudAPIError('Report missing metadata');
    }

    if (!encodedReport.components || encodedReport.components.length === 0) {
      throw new SonarCloudAPIError('Report missing components');
    }

    logger.debug('Report validation passed');
    return true;
  }
}
