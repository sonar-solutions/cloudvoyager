import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Build Compute Engine related methods.
 */
export function buildCeMethods(client, projectKey) {
  return {
    async getMostRecentCeTask() {
      const response = await client.get('/api/ce/activity', { params: { component: projectKey, ps: 1, status: 'SUCCESS,FAILED,CANCELED,PENDING,IN_PROGRESS' } });
      return (response.data.tasks || [])[0] || null;
    },

    async getAnalysisStatus(ceTaskId) {
      const response = await client.get('/api/ce/task', { params: { id: ceTaskId } });
      return response.data.task;
    },

    async waitForAnalysis(ceTaskId, maxWaitSeconds = 300) {
      logger.info(`Waiting for analysis to complete (task: ${ceTaskId})...`);
      const startTime = Date.now();
      const maxWaitMs = maxWaitSeconds * 1000;
      let pollInterval = 2000;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const task = await this.getAnalysisStatus(ceTaskId);
        logger.debug(`Analysis status: ${task.status}`);
        if (task.status === 'SUCCESS') { logger.info('Analysis completed successfully'); return task; }
        if (task.status === 'FAILED' || task.status === 'CANCELED') {
          throw new SonarCloudAPIError(`Analysis ${task.status.toLowerCase()}: ${task.errorMessage || 'Unknown error'}`);
        }
        if (Date.now() - startTime > maxWaitMs) throw new SonarCloudAPIError(`Analysis timeout after ${maxWaitSeconds} seconds`);
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        pollInterval = Math.min(pollInterval * 1.5, 30000);
      }
    },
  };
}
