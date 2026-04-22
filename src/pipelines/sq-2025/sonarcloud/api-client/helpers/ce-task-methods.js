import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- CE Task Methods --------

/** Get the most recent CE task for a project. */
export async function getMostRecentCeTask(client, projectKey) {
  const response = await client.get('/api/ce/activity', {
    params: { component: projectKey, ps: 1, status: 'SUCCESS,FAILED,CANCELED,PENDING,IN_PROGRESS' },
  });
  const tasks = response.data.tasks || [];
  return tasks.length > 0 ? tasks[0] : null;
}

/** Get analysis status for a specific CE task. */
export async function getAnalysisStatus(client, ceTaskId) {
  try {
    const response = await client.get('/api/ce/task', { params: { id: ceTaskId } });
    return response.data.task;
  } catch (error) {
    logger.error(`Failed to get analysis status: ${error.message}`);
    throw error;
  }
}

/** Poll CE task until it completes, fails, or times out. */
export async function waitForAnalysis(client, ceTaskId, maxWaitSeconds = 300) {
  logger.info(`Waiting for analysis to complete (task: ${ceTaskId})...`);
  const startTime = Date.now();
  const maxWaitMs = maxWaitSeconds * 1000;
  let pollInterval = 2000;
  const maxPollInterval = 30000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const task = await getAnalysisStatus(client, ceTaskId);
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
