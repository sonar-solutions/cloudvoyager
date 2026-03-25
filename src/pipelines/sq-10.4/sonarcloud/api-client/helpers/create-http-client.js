import axios from 'axios';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Create an Axios HTTP client with rate limiting and retry interceptors.
export function createHttpClient(baseURL, token, maxRetries, baseDelay, minRequestInterval, sharedThrottler, handleError) {
  const client = axios.create({
    baseURL, auth: { username: token, password: '' },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 60000,
  });

  const throttleState = { _lastPostTime: 0 };

  client.interceptors.request.use(async (reqConfig) => {
    if (reqConfig.method === 'post') {
      const throttler = sharedThrottler || throttleState;
      const now = Date.now();
      const elapsed = now - throttler._lastPostTime;
      throttler._lastPostTime = now + Math.max(0, minRequestInterval - elapsed);
      if (elapsed < minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, minRequestInterval - elapsed));
      }
    }
    return reqConfig;
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
          logger.warn(`Rate limited (${status}), retry ${cfg._retryCount}/${maxRetries} in ${(delay / 1000).toFixed(1)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return client(cfg);
        }
        logger.error(`Rate limited (${status}), exhausted all ${maxRetries} retries`);
      }
      return handleError(error);
    },
  );

  return { client, throttleState };
}
