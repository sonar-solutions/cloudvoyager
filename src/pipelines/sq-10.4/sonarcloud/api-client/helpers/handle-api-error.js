import { SonarCloudAPIError, AuthenticationError } from '../../../../../shared/utils/errors.js';

// -------- Main Logic --------

/**
 * Handle SonarCloud API errors with appropriate error types.
 */
export function handleApiError(error, baseURL) {
  if (error.response) {
    const { status, data, config } = error.response;
    if (status === 401 || status === 403) {
      throw new AuthenticationError(`Authentication failed for SonarCloud: ${data.errors?.[0]?.msg || 'Invalid credentials'}`, 'SonarCloud');
    }
    const message = data.errors?.[0]?.msg || data.message || error.message;
    throw new SonarCloudAPIError(`SonarCloud API error (${status}): ${message}`, status, config.url);
  }

  if (error.request) {
    const url = baseURL || error.config?.baseURL || 'unknown';
    const errorCode = error.code || 'UNKNOWN';
    let message = `Cannot connect to SonarCloud server at ${url}`;
    if (errorCode === 'ECONNREFUSED') message += ' - Connection refused. Is the server running?';
    else if (errorCode === 'ETIMEDOUT') message += ' - Connection timed out';
    else if (errorCode === 'ENOTFOUND') message += ' - Server not found. Check the URL';
    else message += ` - ${error.message} (${errorCode})`;
    throw new SonarCloudAPIError(message, 0, error.config?.url);
  }

  throw new SonarCloudAPIError(`Request failed: ${error.message}`);
}
