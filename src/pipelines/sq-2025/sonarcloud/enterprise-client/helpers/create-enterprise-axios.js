import axios from 'axios';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Create Enterprise Axios Client --------

/** Create an Axios instance configured for the Enterprise V2 API. */
export function createEnterpriseAxios(baseURL, token, maxRetries, baseDelay) {
  const client = axios.create({
    baseURL,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 60000,
  });

  client.interceptors.response.use(
    response => response,
    async (error) => {
      const status = error.response?.status;
      const cfg = error.config;
      if ((status === 503 || status === 429) && cfg) {
        cfg._retryCount = (cfg._retryCount || 0) + 1;
        if (cfg._retryCount <= maxRetries) {
          const delay = baseDelay * Math.pow(2, cfg._retryCount - 1);
          logger.warn(`Enterprise API rate limited (${status}), retry ${cfg._retryCount}/${maxRetries} in ${(delay / 1000).toFixed(1)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return client(cfg);
        }
      }
      return handleEnterpriseError(error, baseURL);
    },
  );

  return client;
}

function handleEnterpriseError(error, baseURL) {
  if (error.response) {
    const { status, data, config } = error.response;
    throw new SonarCloudAPIError(`Enterprise API error (${status}): ${data?.message || data?.errors?.[0]?.msg || error.message}`, status, config.url);
  }
  if (error.request) throw new SonarCloudAPIError(`Cannot connect to Enterprise API at ${baseURL}: ${error.message}`, 0, error.config?.url);
  throw new SonarCloudAPIError(`Enterprise API request failed: ${error.message}`);
}
