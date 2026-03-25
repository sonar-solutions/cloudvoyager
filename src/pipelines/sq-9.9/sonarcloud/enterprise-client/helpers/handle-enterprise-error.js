import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- Enterprise API Error Handler --------

export function handleEnterpriseError(error, baseURL) {
  if (error.response) {
    const { status, data, config } = error.response;
    const message = data?.message || data?.errors?.[0]?.msg || error.message;
    throw new SonarCloudAPIError(`Enterprise API error (${status}): ${message}`, status, config.url);
  }
  if (error.request) {
    throw new SonarCloudAPIError(`Cannot connect to Enterprise API at ${baseURL}: ${error.message}`, 0, error.config?.url);
  }
  throw new SonarCloudAPIError(`Enterprise API request failed: ${error.message}`);
}
