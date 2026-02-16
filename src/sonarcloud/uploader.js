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
   * Submit report to SonarCloud Compute Engine
   */
  async submitToComputeEngine(reportData, metadata) {
    logger.info('Submitting to SonarCloud Compute Engine...');

    try {
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

      const response = await this.client.client.post('/api/ce/submit', form, {
        headers: {
          ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
      });

      const ceTask = response.data.ceTask || response.data.task || {
        id: response.data.taskId || 'unknown'
      };

      logger.info('Report submitted to Compute Engine');

      return ceTask;

    } catch (error) {
      if (error.response) {
        const { status, data } = error.response;
        throw new SonarCloudAPIError(
          `Failed to submit to CE (${status}): ${data.errors?.[0]?.msg || data.message || 'Unknown error'}`,
          status
        );
      }
      throw error;
    }
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
