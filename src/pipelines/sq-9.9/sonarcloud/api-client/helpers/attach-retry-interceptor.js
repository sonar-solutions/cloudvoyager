import logger from '../../../../../shared/utils/logger.js';
import { handleError } from './handle-error.js';

// -------- Attach Retry Interceptor for 429/503 --------

export function attachRetryInterceptor(axiosClient, maxRetries, baseDelay, baseURL) {
  axiosClient.interceptors.response.use(
    response => response,
    async (error) => {
      const status = error.response?.status;
      const cfg = error.config;
      if ((status === 503 || status === 429) && cfg) {
        cfg._retryCount = (cfg._retryCount || 0) + 1;
        if (cfg._retryCount <= maxRetries) {
          const delay = baseDelay * Math.pow(2, cfg._retryCount - 1);
          logger.warn(`Rate limited (${status}), retry ${cfg._retryCount}/${maxRetries} in ${(delay / 1000).toFixed(1)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return axiosClient(cfg);
        }
        logger.error(`Rate limited (${status}), exhausted all ${maxRetries} retries`);
      }
      return handleError(error, baseURL);
    },
  );
}
