import logger from '../../../../../../shared/utils/logger.js';

// -------- Configuration --------

const STUB_REVISION = 'cloudvoyager000000000000000000000000000';
const STUB_AUTHOR = 'cloudvoyager-migration@sonarcloud.io';

// -------- Main Logic --------

// Extract SCM changeset (blame) data from SonarQube.
export async function extractChangesets(client, sourceFiles, components) {
  logger.info('Extracting SCM changeset data...');

  const changesets = new Map();
  const timestamp = Date.now();

  for (const file of sourceFiles) {
    if (!file?.key) { logger.warn('Skipping file without key in changesets extraction'); continue; }
    try {
      const lineCount = resolveLineCount(file, components);
      changesets.set(file.key, {
        componentRef: null,
        changesets: [{ revision: STUB_REVISION, author: STUB_AUTHOR, date: timestamp }],
        changesetIndexByLine: new Array(lineCount).fill(0)
      });
    } catch (error) {
      logger.warn(`Failed to create changeset for ${file.key}: ${error.message}`);
    }
  }

  logger.info(`Created ${changesets.size} changeset entries`);
  return changesets;
}

// -------- Helper Functions --------

function resolveLineCount(file, components) {
  if (Array.isArray(file.lines)) return file.lines.length;
  if (typeof file.lines === 'string') return file.lines.split('\n').length;
  const comp = components?.find?.(c => c.key === file.key);
  const linesMeasure = comp?.measures?.find?.(m => m.metric === 'lines');
  return linesMeasure ? Number.parseInt(linesMeasure.value, 10) || 1 : 1;
}
