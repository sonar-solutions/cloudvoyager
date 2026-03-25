import logger from '../../../../../../shared/utils/logger.js';

// -------- Wait for Main Branch --------

/** Wait for main branch CE task to complete before starting non-main branches. */
export async function waitForMainBranchIfNeeded(mainBranchResult, wait, sonarCloudClient) {
  if (wait || !mainBranchResult.ceTask?.id) return;

  logger.info(`Waiting for main branch CE task ${mainBranchResult.ceTask.id} to complete...`);
  try {
    await sonarCloudClient.waitForAnalysis(mainBranchResult.ceTask.id, 600);
    logger.info('Main branch analysis completed — proceeding with non-main branches');
  } catch (error) {
    logger.error(`Main branch analysis did not complete: ${error.message}`);
    logger.warn('Attempting non-main branch transfers anyway...');
  }
}
