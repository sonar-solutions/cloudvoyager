import logger from '../../../../../shared/utils/logger.js';
import { extractMeasures } from '../measures.js';
import { extractSources } from '../sources.js';
import { extractChangesets } from '../changesets.js';
import { extractSymbols } from '../symbols.js';
import { extractSyntaxHighlighting } from '../syntax-highlighting.js';
import { extractDuplications } from '../duplications.js';
import { getCommonMetricKeys } from '../metrics.js';

// -------- Main Logic --------

/**
 * Extract source-related data: measures, sources, duplications,
 * changesets, symbols, and syntax highlighting.
 *
 * @param {object} extractor - DataExtractor instance
 * @param {object} data - Data accumulator to populate
 * @param {Array} sourceFilesList - Source files from core extraction
 */
export async function extractSourceData(extractor, data, sourceFilesList) {
  const metricKeys = getCommonMetricKeys(data.metrics);
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  const srcConc = extractor.performanceConfig.sourceExtraction?.concurrency || 10;
  const dupConc = extractor.performanceConfig.sourceExtraction?.concurrency || 5;

  logger.info('Step 6/7: Extracting project measures...');
  data.measures = await extractMeasures(extractor.client, metricKeys);

  logger.info('Step 7/7: Extracting source code...');
  data.sources = await extractSources(extractor.client, null, maxFiles, { concurrency: srcConc });

  logger.info('Step 7b: Extracting duplications...');
  data.duplications = await extractDuplications(extractor.client, data.components, null, { concurrency: dupConc });

  logger.info('Step 8/10: Extracting changesets...');
  data.changesets = await extractChangesets(extractor.client, sourceFilesList, data.components, data.issues);

  logger.info('Step 9/10: Extracting symbols...');
  data.symbols = await extractSymbols(extractor.client, sourceFilesList);

  logger.info('Step 10/10: Extracting syntax highlighting...');
  data.syntaxHighlightings = await extractSyntaxHighlighting(extractor.client, sourceFilesList);
}
