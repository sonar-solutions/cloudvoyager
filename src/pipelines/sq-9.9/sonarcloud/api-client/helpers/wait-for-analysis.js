import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Wait for CE Analysis to Complete --------

export async function getAnalysisStatus(ctx, ceTaskId) {
  const response = await ctx.client.get('/api/ce/task', { params: { id: ceTaskId } });
  return response.data.task;
}

export async function waitForAnalysis(ctx, ceTaskId, maxWaitSeconds = 300) {
  logger.info(`Waiting for analysis to complete (task: ${ceTaskId})...`);
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  let pollInterval = 2000;
  const maxPollInterval = 30000;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const task = await getAnalysisStatus(ctx, ceTaskId);
    logger.debug(`Analysis status: ${task.status}`);
    if (task.status === 'SUCCESS') { logger.info('Analysis completed successfully'); return task; }
    if (task.status === 'FAILED' || task.status === 'CANCELED') {
      const reason = task.errorMessage || task.errorType || 'Unknown error (check SonarCloud CE task ' + ceTaskId + ')';
      if (reason.includes('a newer report has already been processed')) {
        logger.warn(`Analysis rejected (newer report exists) — treating as success for migration resume`);
        return task;
      }
      throw new SonarCloudAPIError(`Analysis ${task.status.toLowerCase()}: ${reason}`);
    }
    if (Date.now() - startTime > maxWaitMs) throw new SonarCloudAPIError(`Analysis timeout after ${maxWaitSeconds} seconds`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
  }
}
