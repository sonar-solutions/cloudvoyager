import { SonarCloudAPIError } from '../../../../../../../shared/utils/errors.js';
import { findTaskFromActivity } from '../../find-task-from-activity.js';

// -------- Handle Timeout Result --------

/** Handle TIMEOUT result by checking activity for CE task. */
export async function handleTimeoutResult(client, uploadStart, attempt, maxAttempts, activityChecks, activityInterval) {
  const task = await findTaskFromActivity(client, uploadStart, activityChecks, activityInterval);
  if (task) return task;

  if (attempt === maxAttempts) {
    throw new SonarCloudAPIError(
      `Report submission failed after ${maxAttempts} attempts — server did not acknowledge the report.`
    );
  }
  return null;
}
