import { SonarQubeAPIError, AuthenticationError } from '../../../../../shared/utils/errors.js';

// -------- Main Logic --------

// Handle SonarQube API errors, converting to typed errors.
export function handleApiError(error, baseURL) {
  if (error.response) {
    const { status, data, config } = error.response;
    if (status === 401 || status === 403) {
      throw new AuthenticationError(`Authentication failed for SonarQube: ${data.errors?.[0]?.msg || 'Invalid credentials'}`, 'SonarQube');
    }
    const message = data.errors?.[0]?.msg || data.message || error.message;
    throw new SonarQubeAPIError(`SonarQube API error (${status}): ${message}`, status, config.url);
  }

  if (error.request) {
    const base = baseURL || error.config?.baseURL || 'unknown';
    const errorCode = error.code || 'UNKNOWN';
    let message = `Cannot connect to SonarQube server at ${base}`;
    if (errorCode === 'ECONNREFUSED') message += ' - Connection refused. Is the server running?';
    else if (errorCode === 'ETIMEDOUT') message += ' - Connection timed out';
    else if (errorCode === 'ENOTFOUND') message += ' - Server not found. Check the URL';
    else message += ` - ${error.message} (${errorCode})`;
    throw new SonarQubeAPIError(message, 0, error.config?.url);
  }

  throw new SonarQubeAPIError(`Request failed: ${error.message}`);
}
