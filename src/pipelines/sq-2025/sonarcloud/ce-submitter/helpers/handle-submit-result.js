import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- Handle Submit Result --------

/** Handle the result from a CE submission attempt. Returns a task, 'retry', or throws. */
export async function handleSubmitResult(result, TIMEOUT, client, uploadStart, attempt, maxAttempts, activityChecks, checkIntervalMs, findTaskFn) {
  if (result === TIMEOUT) {
    logger.warn(`No response from /api/ce/submit after 60s — falling back to CE activity lookup`);
    const task = await findTaskFn(client, uploadStart, activityChecks, checkIntervalMs);
    if (task) return task;
    if (attempt === maxAttempts) {
      throw new SonarCloudAPIError(
        `Report submission failed after ${maxAttempts} attempts. ` +
        `Total activity checks across all attempts: ${maxAttempts * activityChecks}. ` +
        'The SonarCloud server did not acknowledge or process the report.',
      );
    }
    return 'retry';
  }

  if (result instanceof Error) {
    if (result.response) {
      const { status, data } = result.response;
      throw new SonarCloudAPIError(`Failed to submit to CE (${status}): ${data.errors?.[0]?.msg || data.message || 'Unknown error'}`, status);
    }
    throw result;
  }

  const ceTask = result.data.ceTask || result.data.task || { id: result.data.taskId || 'unknown' };
  const totalSeconds = ((Date.now() - uploadStart) / 1000).toFixed(1);
  logger.info(`Report submitted to Compute Engine (took ${totalSeconds}s)`);
  return ceTask;
}
