import logger from '../../../../../shared/utils/logger.js';

// -------- Find CE Task from Activity API --------

export async function findTaskFromActivity(client, uploadStart, maxChecks = 5, intervalMs = 3000) {
  logger.info(`Looking up CE task from activity API (${maxChecks} checks, ${intervalMs / 1000}s interval)...`);

  for (let check = 1; check <= maxChecks; check++) {
    const task = await client.getMostRecentCeTask();
    if (task) {
      const taskSubmittedAt = task.submittedAt ? new Date(task.submittedAt).getTime() : 0;
      if (taskSubmittedAt >= uploadStart - 30_000) {
        const elapsed = ((Date.now() - uploadStart) / 1000).toFixed(1);
        logger.info(`Found CE task ${task.id} (status: ${task.status}) on check ${check}/${maxChecks} (${elapsed}s)`);
        return { id: task.id, status: task.status };
      }
    }
    logger.debug(`CE activity check ${check}/${maxChecks}: no matching task`);
    if (check < maxChecks) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  logger.warn(`No CE task found after ${maxChecks} activity checks (${((Date.now() - uploadStart) / 1000).toFixed(1)}s)`);
  return null;
}
