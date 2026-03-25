import logger from '../../../../../shared/utils/logger.js';
import { extractProjectData } from '../projects.js';
import { extractIssues } from '../issues.js';
import { extractMetrics, getCommonMetricKeys } from '../metrics.js';
import { extractComponentMeasures } from '../measures.js';
import { extractActiveRules } from '../rules.js';
import { extractHotspotsAsIssues } from '../hotspots-to-issues.js';

// -------- Main Logic --------

/**
 * Extract core data: project, metrics, components, rules, issues, hotspots.
 * Populates the provided data object in-place.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {object} data - Data accumulator to populate
 * @returns {Promise<Array>} sourceFilesList for downstream steps
 */
export async function extractCoreData(extractor, data) {
  logger.info('Step 1/7: Extracting project data...');
  data.project = await extractProjectData(extractor.client);

  const scmRevision = await extractor.client.getLatestAnalysisRevision();
  if (scmRevision) data.metadata.scmRevisionId = scmRevision;

  logger.info('Step 2/7: Extracting metrics...');
  data.metrics = await extractMetrics(extractor.client);
  const metricKeys = getCommonMetricKeys(data.metrics);

  logger.info('Step 3/7: Extracting component measures...');
  data.components = await extractComponentMeasures(extractor.client, metricKeys);

  logger.info('Step 3b/7: Extracting source file list...');
  const sourceFilesList = await extractor.client.getSourceFiles();

  logger.info('Step 4/7: Extracting active rules...');
  data.activeRules = await extractActiveRules(extractor.client, sourceFilesList);

  logger.info('Step 5/7: Extracting issues...');
  data.issues = await extractIssues(extractor.client, extractor.state);

  logger.info('Step 5b: Extracting security hotspots...');
  const hotspotIssues = await extractHotspotsAsIssues(extractor.client);
  if (hotspotIssues.length > 0) {
    data.issues.push(...hotspotIssues);
    logger.info(`Added ${hotspotIssues.length} hotspots (total: ${data.issues.length})`);
  }

  return sourceFilesList;
}
