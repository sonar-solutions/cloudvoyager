import logger from '../../../../../shared/utils/logger.js';
import { extractCoreData } from './extract-core-data.js';
import { extractSourceData } from './extract-source-data.js';
import { logExtractionSummary } from './log-extraction-summary.js';

// -------- Main Logic --------

/**
 * Extract all data from SonarQube (main branch).
 *
 * @param {object} extractor - DataExtractor instance
 * @returns {Promise<object>} Extracted data
 */
export async function extractAll(extractor) {
  logger.info('Starting full data extraction from SonarQube...');
  const startTime = Date.now();

  const data = {
    project: null, metrics: [], issues: [],
    measures: {}, components: [], sources: [],
    activeRules: [], duplications: new Map(),
    changesets: new Map(), symbols: new Map(),
    syntaxHighlightings: new Map(),
    metadata: { extractedAt: new Date().toISOString(), mode: extractor.config.transfer.mode },
  };

  try {
    const sourceFilesList = await extractCoreData(extractor, data);
    await extractSourceData(extractor, data, sourceFilesList);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Data extraction completed in ${duration}s`);
    logExtractionSummary(data);
    return data;
  } catch (error) {
    logger.error(`Data extraction failed: ${error.message}`);
    throw error;
  }
}
