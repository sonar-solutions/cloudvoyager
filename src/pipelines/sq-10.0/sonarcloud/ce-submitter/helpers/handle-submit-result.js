import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- Handle Submit Result --------

/**
 * Handle the result of the /api/ce/submit call.
 * Returns a CE task object on success, or null to signal a retry.
 */
export function handleSubmitResult(result, uploadStart) {
  if (result instanceof Error) {
    if (result.response) {
      const { status, data } = result.response;
      throw new SonarCloudAPIError(
        `Failed to submit to CE (${status}): ${data.errors?.[0]?.msg || data.message || 'Unknown error'}`,
        status,
      );
    }
    throw result;
  }

  const ceTask = result.data.ceTask || result.data.task || { id: result.data.taskId || 'unknown' };
  const totalSeconds = ((Date.now() - uploadStart) / 1000).toFixed(1);
  logger.info(`Report submitted to Compute Engine (took ${totalSeconds}s)`);
  return ceTask;
}
