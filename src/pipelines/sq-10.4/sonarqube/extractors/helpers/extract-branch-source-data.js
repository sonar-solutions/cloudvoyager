import logger from '../../../../../shared/utils/logger.js';
import { extractMeasures } from '../measures.js';
import { extractSources } from '../sources.js';
import { extractChangesets } from '../changesets.js';
import { extractSymbols } from '../symbols.js';
import { extractSyntaxHighlighting } from '../syntax-highlighting.js';
import { extractDuplications } from '../duplications.js';

// -------- Main Logic --------

/**
 * Extract source-related data for a branch.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {string} branch - Branch name
 * @param {Array<string>} metricKeys - Metric keys
 * @param {Array} components - Components from branch extraction
 * @param {Array} sourceFilesList - Source files list
 * @returns {Promise<object>} Source data fields
 */
export async function extractBranchSourceData(extractor, branch, metricKeys, components, sourceFilesList, issues = []) {
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const srcConc = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConc = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  logger.info(`  [${branch}] Extracting project measures...`);
  const measures = await extractMeasures(extractor.client, metricKeys, branch);

  logger.info(`  [${branch}] Extracting source code...`);
  const sources = await extractSources(extractor.client, branch, maxFiles, { concurrency: srcConc });

  logger.info(`  [${branch}] Extracting duplications...`);
  const duplications = await extractDuplications(extractor.client, components, branch, { concurrency: dupConc });

  logger.info(`  [${branch}] Extracting changesets...`);
  const changesets = await extractChangesets(extractor.client, sourceFilesList, components, issues);

  logger.info(`  [${branch}] Extracting symbols...`);
  const symbols = await extractSymbols(extractor.client, sourceFilesList);

  logger.info(`  [${branch}] Extracting syntax highlighting...`);
  const syntaxHighlightings = await extractSyntaxHighlighting(extractor.client, sourceFilesList);

  return { measures, sources, duplications, changesets, symbols, syntaxHighlightings };
}
