// -------- Get Common Metric Keys --------

import logger from '../../../../../../shared/utils/logger.js';
import { COMMON_METRICS } from './common-metrics.js';

export function getCommonMetricKeys(allMetrics) {
  const availableKeys = new Set(allMetrics.map(m => m.key));
  const commonKeys = COMMON_METRICS.filter(key => availableKeys.has(key));

  logger.info(`Selected ${commonKeys.length} common metrics for extraction`);
  return commonKeys;
}
