// -------- Log CE Tasks --------
import logger from '../../logger.js';

export function logCeTasks(journal) {
  if (!journal.uploadedCeTasks || Object.keys(journal.uploadedCeTasks).length === 0) return;
  logger.info('');
  logger.info('Uploaded CE tasks:');
  for (const [branch, task] of Object.entries(journal.uploadedCeTasks)) {
    logger.info(`  ${branch}: ${task.taskId} (${task.status})`);
  }
}
