import { SonarCloudAPIError } from '../../../../../../../shared/utils/errors.js';

// -------- Handle Error Result --------

/** Handle error result from report submission. */
export function handleErrorResult(result) {
  if (result.response) {
    const { status, data } = result.response;
    throw new SonarCloudAPIError(
      `Failed to submit to CE (${status}): ${data.errors?.[0]?.msg || data.message || 'Unknown error'}`,
      status
    );
  }
  throw result;
}
