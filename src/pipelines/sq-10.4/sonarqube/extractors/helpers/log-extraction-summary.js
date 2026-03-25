import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Log a summary of the extracted data.
 * @param {object} data - Extracted data
 */
export function logExtractionSummary(data) {
  logger.info('=== Extraction Summary ===');
  logger.info(`Project: ${data.project.project.name}`);
  logger.info(`Branches: ${data.project.branches.length}`);
  logger.info(`Metrics: ${data.metrics.length}`);
  logger.info(`Active Rules: ${data.activeRules.length}`);

  const hotspotCount = data.issues.filter(i => i.type === 'SECURITY_HOTSPOT').length;
  logger.info(`Issues: ${data.issues.length - hotspotCount} (+ ${hotspotCount} security hotspots)`);
  logger.info(`Project Measures: ${data.measures.measures.length}`);
  logger.info(`Components: ${data.components.length}`);
  logger.info(`Source Files: ${data.sources.length}`);
  logger.info('=========================');
}
