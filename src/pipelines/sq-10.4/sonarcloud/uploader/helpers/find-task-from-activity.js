import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Fallback: find the CE task via /api/ce/activity when the submit response is lost.
 *
 * @param {object} client - SonarCloud API client
 * @param {number} uploadStart - Timestamp of when the upload started
 * @param {number} maxChecks - Maximum number of activity checks
 * @param {number} checkIntervalMs - Interval between checks
 * @returns {Promise<object|null>} CE task object or null
 */
export async function findTaskFromActivity(client, uploadStart, maxChecks = 5, checkIntervalMs = 3000) {
  logger.info(`Looking up CE task from activity API (${maxChecks} checks, ${checkIntervalMs / 1000}s interval)...`);

  for (let check = 1; check <= maxChecks; check++) {
    const task = await client.getMostRecentCeTask();
    if (task) {
      const taskSubmittedAt = task.submittedAt ? new Date(task.submittedAt).getTime() : 0;
      if (taskSubmittedAt >= uploadStart - 30_000) {
        const totalSeconds = ((Date.now() - uploadStart) / 1000).toFixed(1);
        logger.info(`Found CE task ${task.id} (status: ${task.status}) via activity lookup on check ${check}/${maxChecks} (took ${totalSeconds}s)`);
        return { id: task.id, status: task.status };
      }
    }
    logger.debug(`CE activity check ${check}/${maxChecks}: no matching task found`);
    if (check < maxChecks) await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
  }

  logger.warn(`No CE task found after ${maxChecks} activity checks (${((Date.now() - uploadStart) / 1000).toFixed(1)}s elapsed)`);
  return null;
}
