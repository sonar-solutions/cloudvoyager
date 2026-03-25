import FormData from 'form-data';
import logger from '../../../../../shared/utils/logger.js';

// -------- Build Multipart Form for CE Submission --------

export function buildFormData(client, reportData, metadata) {
  const form = new FormData();

  form.append('report', reportData, { contentType: 'application/zip', filename: 'scanner-report.zip' });
  form.append('projectKey', client.projectKey);
  form.append('organization', client.organization);

  // Branch characteristics for non-main branches
  if (metadata.branchName) {
    form.append('characteristic', `branch=${metadata.branchName}`);
    form.append('characteristic', 'branchType=LONG');
    logger.info(`Branch characteristics: branch=${metadata.branchName}, branchType=LONG`);
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
