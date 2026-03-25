import { extractMeasures } from '../../../measures.js';
import { extractSources } from '../../../sources.js';
import { extractDuplications } from '../../../duplications.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Extract Measures and Sources --------

/** Steps 6-7b: Extract project measures, source code, and duplications. */
export async function extractMeasuresAndSources(ext, data) {
  logger.info('Step 6/7: Extracting project measures...');
  data.measures = await extractMeasures(ext.client, data._metricKeys);

  logger.info('Step 7/7: Extracting source code...');
  const maxFiles = Math.max(0, Number.parseInt(process.env.MAX_SOURCE_FILES || '0', 10) || 0);
  data.sources = await extractSources(ext.client, null, maxFiles, {
    concurrency: ext.performanceConfig.sourceExtraction?.concurrency || 10,
  });

  logger.info('Step 7b: Extracting duplications...');
  data.duplications = await extractDuplications(ext.client, data.components, null, {
    concurrency: ext.performanceConfig.sourceExtraction?.concurrency || 5,
  });
}
