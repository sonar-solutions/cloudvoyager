import logger from '../../../../shared/utils/logger.js';

// -------- Wait for Main Branch Analysis --------

/**
 * Wait for main branch CE task to complete before syncing non-main branches.
 * SonarCloud requires main branch analysis to finish first.
 */
export async function waitForMainAnalysis(sonarCloudClient, ceTaskId, wait) {
  if (wait || !ceTaskId) return;
  logger.info(`Waiting for main branch CE task ${ceTaskId} to complete...`);
  try {
    await sonarCloudClient.waitForAnalysis(ceTaskId, 600);
    logger.info('Main branch analysis completed — proceeding with non-main branches');
  } catch (error) {
    logger.error(`Main branch analysis did not complete: ${error.message}`);
    logger.warn('Attempting non-main branch transfers anyway...');
  }
}
