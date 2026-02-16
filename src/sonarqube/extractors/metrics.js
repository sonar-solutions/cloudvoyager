import logger from '../../utils/logger.js';
import { createMetricData } from '../models.js';

/**
 * Common metrics to extract
 */
export const COMMON_METRICS = [
  'ncloc',                    // Lines of code
  'complexity',               // Cyclomatic complexity
  'cognitive_complexity',     // Cognitive complexity
  'coverage',                 // Code coverage
  'line_coverage',            // Line coverage
  'branch_coverage',          // Branch coverage
  'duplicated_lines_density', // Duplicated lines density
  'violations',               // Total issues
  'bugs',                     // Bug count
  'vulnerabilities',          // Vulnerability count
  'code_smells',              // Code smell count
  'security_hotspots',        // Security hotspot count
  'sqale_index',              // Technical debt
  'sqale_rating',             // Maintainability rating
  'reliability_rating',       // Reliability rating
  'security_rating',          // Security rating
  'alert_status'              // Quality gate status
];

/**
 * Extract metrics definitions from SonarQube
 * @param {SonarQubeClient} client - SonarQube client
 * @returns {Promise<Array<MetricData>>}
 */
export async function extractMetrics(client) {
  logger.info('Extracting metrics definitions...');

  const metrics = await client.getMetrics();
  logger.info(`Extracted ${metrics.length} metric definitions`);

  // Convert to MetricData models
  const metricData = metrics.map(metric => createMetricData(metric));

  return metricData;
}

/**
 * Get metric keys for common metrics
 * @param {Array<MetricData>} allMetrics - All available metrics
 * @returns {Array<string>}
 */
export function getCommonMetricKeys(allMetrics) {
  const availableKeys = new Set(allMetrics.map(m => m.key));
  const commonKeys = COMMON_METRICS.filter(key => availableKeys.has(key));

  logger.info(`Selected ${commonKeys.length} common metrics for extraction`);
  return commonKeys;
}
