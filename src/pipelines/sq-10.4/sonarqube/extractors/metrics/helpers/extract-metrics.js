import logger from '../../../../../../shared/utils/logger.js';
import { createMetricData } from '../../../models.js';

// -------- Main Logic --------

// Extract metrics definitions from SonarQube.
export async function extractMetrics(client) {
  logger.info('Extracting metrics definitions...');
  const metrics = await client.getMetrics();
  logger.info(`Extracted ${metrics.length} metric definitions`);
  return metrics.map(metric => createMetricData(metric));
}
