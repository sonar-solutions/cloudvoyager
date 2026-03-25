import logger from '../../../../../shared/utils/logger.js';

// -------- Find Task From Activity --------

/**
 * Fallback: find the CE task via /api/ce/activity when the submit response is lost.
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

  const totalSeconds = ((Date.now() - uploadStart) / 1000).toFixed(1);
  logger.warn(`No CE task found after ${maxChecks} activity checks (${totalSeconds}s elapsed)`);
  return null;
}
