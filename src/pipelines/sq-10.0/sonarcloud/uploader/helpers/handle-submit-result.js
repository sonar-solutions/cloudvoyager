import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import { findTaskFromActivity } from './find-task-from-activity.js';

// -------- Handle Submit Result (timeout, error, or success) --------

export async function handleSubmitResult({ result, TIMEOUT, client, uploadStart, attempt, MAX_ATTEMPTS, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS }) {
  if (result === TIMEOUT) {
    logger.warn('No response — falling back to activity lookup');
    const task = await findTaskFromActivity(client, uploadStart, ACTIVITY_CHECKS, ACTIVITY_CHECK_INTERVAL_MS);
    if (task) return task;
    if (attempt === MAX_ATTEMPTS) {
      throw new SonarCloudAPIError(`Report submission failed after ${MAX_ATTEMPTS} attempts.`);
    }
    return null;
  }
  if (result instanceof Error) {
    if (result.response) {
      const { status, data } = result.response;
      throw new SonarCloudAPIError(`Failed to submit (${status}): ${data.errors?.[0]?.msg || data.message || 'Unknown'}`, status);
    }
    throw result;
  }
  const ceTask = result.data.ceTask || result.data.task || { id: result.data.taskId || 'unknown' };
  logger.info(`Report submitted to CE (took ${((Date.now() - uploadStart) / 1000).toFixed(1)}s)`);
  return ceTask;
}
