import FormData from 'form-data';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Build the multipart form for CE submission.
 *
 * @param {object} client - SonarCloud API client
 * @param {Buffer} reportData - Zip buffer
 * @param {object} metadata - Analysis metadata
 * @returns {FormData} Configured form data
 */
export function buildSubmitForm(client, reportData, metadata) {
  const form = new FormData();

  form.append('report', reportData, { contentType: 'application/zip', filename: 'scanner-report.zip' });
  form.append('projectKey', client.projectKey);
  form.append('organization', client.organization);

  // Branch characteristics for non-main branches
  if (metadata.branchName) {
    const branchType = metadata.branchType || 'LONG';
    form.append('characteristic', `branch=${metadata.branchName}`);
    form.append('characteristic', `branchType=${branchType}`);
    logger.info(`Branch characteristics: branch=${metadata.branchName}, branchType=${branchType}`);
  }

  const analysisProperties = [
    `sonar.projectKey=${client.projectKey}`,
    `sonar.organization=${client.organization}`,
    `sonar.projectVersion=${metadata.version || '1.0.0'}`,
    'sonar.sourceEncoding=UTF-8',
  ];
  form.append('properties', analysisProperties.join('\n'));

  return form;
}
