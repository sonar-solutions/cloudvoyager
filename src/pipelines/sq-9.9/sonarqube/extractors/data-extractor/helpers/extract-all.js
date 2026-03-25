import logger from '../../../../../../shared/utils/logger.js';
import { createEmptyExtractedData } from './create-empty-extracted-data.js';
import { runAllExtractionSteps } from './run-all-extraction-steps.js';

// -------- Main Extraction --------

export async function extractAll(extractor) {
  logger.info('Starting full data extraction from SonarQube...');
  const startTime = Date.now();
  const data = createEmptyExtractedData(extractor.config);

  try {
    await runAllExtractionSteps(extractor, data);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Data extraction completed in ${duration}s`);
    extractor.logExtractionSummary(data);
    return data;
  } catch (error) {
    logger.error(`Data extraction failed: ${error.message}`);
    throw error;
  }
}
