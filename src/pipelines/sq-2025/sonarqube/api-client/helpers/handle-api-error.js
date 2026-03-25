import { SonarQubeAPIError, AuthenticationError } from '../../../../../shared/utils/errors.js';

// -------- Handle API Error --------

/** Map Axios errors to typed SonarQube errors. */
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
    const url = baseURL || error.config?.baseURL || 'unknown';
    const code = error.code || 'UNKNOWN';
    let msg = `Cannot connect to SonarQube server at ${url}`;
    if (code === 'ECONNREFUSED') msg += ' - Connection refused. Is the server running?';
    else if (code === 'ETIMEDOUT') msg += ' - Connection timed out';
    else if (code === 'ENOTFOUND') msg += ' - Server not found. Check the URL';
    else msg += ` - ${error.message} (${code})`;
    throw new SonarQubeAPIError(msg, 0, error.config?.url);
  }

  throw new SonarQubeAPIError(`Request failed: ${error.message}`);
}
