import logger from '../../../../../shared/utils/logger.js';
import { extractIssues } from '../issues.js';
import { extractComponentMeasures } from '../measures.js';
import { extractHotspotsAsIssues } from '../hotspots-to-issues.js';
import { extractBranchSourceData } from './extract-branch-source-data.js';

// -------- Main Logic --------

/**
 * Extract all branch-specific data from SonarQube.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {string} branch - Branch name
 * @param {Array<string>} metricKeys - Metric keys from main extraction
 * @returns {Promise<object>} Branch extraction context
 */
export async function extractBranchData(extractor, branch, metricKeys) {
  logger.info(`  [${branch}] Extracting component measures...`);
  const components = await extractComponentMeasures(extractor.client, metricKeys, branch);

  logger.info(`  [${branch}] Extracting source file list...`);
  const sourceFilesList = await extractor.client.getSourceFiles(branch);

  logger.info(`  [${branch}] Extracting issues...`);
  const issues = await extractIssues(extractor.client, extractor.state, branch);

  logger.info(`  [${branch}] Extracting security hotspots...`);
  const hotspotIssues = await extractHotspotsAsIssues(extractor.client, branch);
  if (hotspotIssues.length > 0) {
    issues.push(...hotspotIssues);
    logger.info(`  [${branch}] Added ${hotspotIssues.length} hotspots (total: ${issues.length})`);
  }

  const sourceData = await extractBranchSourceData(extractor, branch, metricKeys, components, sourceFilesList);

  return { components, issues, ...sourceData };
}
