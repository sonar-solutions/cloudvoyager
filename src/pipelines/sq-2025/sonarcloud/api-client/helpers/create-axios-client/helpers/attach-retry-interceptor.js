import logger from '../../../../../../../shared/utils/logger.js';
import { handleApiError } from '../../handle-api-error.js';

// -------- Retry Interceptor --------

/** Attach retry interceptor for 429/503 responses. */
export function attachRetryInterceptor(client, state, baseURL) {
  client.interceptors.response.use(
    response => response,
    async (error) => {
      const status = error.response?.status;
      const cfg = error.config;
      if ((status === 503 || status === 429) && cfg) {
        cfg._retryCount = (cfg._retryCount || 0) + 1;
        if (cfg._retryCount <= state._maxRetries) {
          const delay = state._baseDelay * Math.pow(2, cfg._retryCount - 1);
          logger.warn(`Rate limited (${status}), retry ${cfg._retryCount}/${state._maxRetries} in ${(delay / 1000).toFixed(1)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return client(cfg);
        }
        logger.error(`Rate limited (${status}), exhausted all ${state._maxRetries} retries`);
      }
      return handleApiError(error, baseURL);
    },
  );
}
