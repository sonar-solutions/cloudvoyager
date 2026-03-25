import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- Handle CE Submit Result (timeout, error, or success) --------

export function handleSubmitResult(result, uploadStart) {
  // Real HTTP error
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

  // Successful response
  const response = result;
  const ceTask = response.data.ceTask || response.data.task || { id: response.data.taskId || 'unknown' };
  const totalSeconds = ((Date.now() - uploadStart) / 1000).toFixed(1);
  logger.info(`Report submitted to Compute Engine (took ${totalSeconds}s)`);
  return ceTask;
}
