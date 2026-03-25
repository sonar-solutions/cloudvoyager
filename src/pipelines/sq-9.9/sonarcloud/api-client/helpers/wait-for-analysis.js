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
      throw new SonarCloudAPIError(`Analysis ${task.status.toLowerCase()}: ${task.errorMessage || 'Unknown error'}`);
    }
    if (Date.now() - startTime > maxWaitMs) throw new SonarCloudAPIError(`Analysis timeout after ${maxWaitSeconds} seconds`);
    await new Promise(resolve => setTimeout(resolve, pollInterval));
    pollInterval = Math.min(pollInterval * 1.5, maxPollInterval);
  }
}
