import logger from '../../../../../../shared/utils/logger.js';
import { createEmptyExtractedData } from './helpers/create-empty-extracted-data.js';
import { extractProjectMetadata } from './helpers/extract-project-metadata.js';
import { extractMetricsAndComponents } from './helpers/extract-metrics-and-components.js';
import { extractRulesAndIssues } from './helpers/extract-rules-and-issues.js';
import { extractMeasuresAndSources } from './helpers/extract-measures-and-sources.js';
import { extractScmAndHighlighting } from './helpers/extract-scm-and-highlighting.js';

// -------- Main Extraction --------

/** Extract all data from SonarQube (main branch). */
export async function extractAll(extractor) {
  logger.info('Starting full data extraction from SonarQube...');
  const startTime = Date.now();
  const data = createEmptyExtractedData(extractor);

  try {
    await extractProjectMetadata(extractor, data);
    await extractMetricsAndComponents(extractor, data);
    await extractRulesAndIssues(extractor, data);
    await extractMeasuresAndSources(extractor, data);
    await extractScmAndHighlighting(extractor, data);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`Data extraction completed in ${duration}s`);
    extractor.logExtractionSummary(data);
    return data;
  } catch (error) {
    logger.error(`Data extraction failed: ${error.message}`);
    throw error;
  }
}
