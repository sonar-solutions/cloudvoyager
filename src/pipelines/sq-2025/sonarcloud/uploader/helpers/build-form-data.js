import FormData from 'form-data';
import logger from '../../../../../shared/utils/logger.js';

// -------- Build Form Data --------

/** Build and buffer the multipart form for CE submission. */
export async function buildFormData(client, reportData, metadata) {
  const form = new FormData();

  form.append('report', reportData, {
    contentType: 'application/zip',
    filename: 'scanner-report.zip',
  });

  form.append('projectKey', client.projectKey);
  form.append('organization', client.organization);

  // Branch characteristics for non-main branches
  if (metadata.branchName) {
    form.append('characteristic', `branch=${metadata.branchName}`);
    form.append('characteristic', 'branchType=LONG');
    logger.info(`Branch characteristics: branch=${metadata.branchName}, branchType=LONG`);
  }

  const props = [
    `sonar.projectKey=${client.projectKey}`,
    `sonar.organization=${client.organization}`,
    `sonar.projectVersion=${metadata.version || '1.0.0'}`,
    'sonar.sourceEncoding=UTF-8',
  ];
  form.append('properties', props.join('\n'));

  // Buffer the form data before sending (avoids Bun streaming issues)
  const formHeaders = form.getHeaders();
  const formBuffer = await new Promise((resolve, reject) => {
    const chunks = [];
    form.on('data', chunk => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk));
    form.on('end', () => resolve(Buffer.concat(chunks)));
    form.on('error', reject);
    form.resume();
  });

  return { formHeaders, formBuffer };
}
