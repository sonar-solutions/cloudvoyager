import axios from 'axios';
import logger from '../../../../../shared/utils/logger.js';
import { handleEnterpriseError } from './handle-enterprise-error.js';

// -------- Create Axios Client for Enterprise V2 API --------

export function createEnterpriseAxios({ url, token, rateLimit = {} }) {
  const parsed = new URL(url);
  const baseURL = `${parsed.protocol}//api.${parsed.host}/enterprises`;
  const maxRetries = rateLimit.maxRetries ?? 3;
  const baseDelay = rateLimit.baseDelay ?? 1000;

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

  return { client, baseURL, token };
}
