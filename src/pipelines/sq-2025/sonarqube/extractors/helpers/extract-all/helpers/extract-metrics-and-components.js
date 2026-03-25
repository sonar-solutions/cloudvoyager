import { extractMetrics, getCommonMetricKeys } from '../../../metrics.js';
import { extractComponentMeasures } from '../../../measures.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Extract Metrics and Components --------

/** Steps 2-3b: Extract metrics, component measures, and source file list. */
export async function extractMetricsAndComponents(ext, data) {
  logger.info('Step 2/7: Extracting metrics...');
  data.metrics = await extractMetrics(ext.client);
  const metricKeys = getCommonMetricKeys(data.metrics);
  data._metricKeys = metricKeys;

  logger.info('Step 3/7: Extracting component measures...');
  data.components = await extractComponentMeasures(ext.client, metricKeys);

  logger.info('Step 3b/7: Extracting source file list...');
  data._sourceFilesList = await ext.client.getSourceFiles();
}
