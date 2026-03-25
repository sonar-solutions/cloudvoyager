import logger from '../../../../../shared/utils/logger.js';
import { createMetricData } from '../../models.js';
import { COMMON_METRICS } from './helpers/common-metrics.js';

// -------- Extract Metrics --------

export async function extractMetrics(client) {
  logger.info('Extracting metrics definitions...');
  const metrics = await client.getMetrics();
  logger.info(`Extracted ${metrics.length} metric definitions`);
  return metrics.map(metric => createMetricData(metric));
}

export function getCommonMetricKeys(allMetrics) {
  const availableKeys = new Set(allMetrics.map(m => m.key));
  const commonKeys = COMMON_METRICS.filter(key => availableKeys.has(key));
  logger.info(`Selected ${commonKeys.length} common metrics for extraction`);
  return commonKeys;
}

export { COMMON_METRICS };
