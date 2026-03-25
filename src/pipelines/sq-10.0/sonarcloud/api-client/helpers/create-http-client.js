import axios from 'axios';
import logger from '../../../../../shared/utils/logger.js';
import { handleApiError } from './handle-api-error.js';

// -------- Create Axios HTTP Client with Interceptors --------

export function createHttpClient(ctx) {
  const client = axios.create({
    baseURL: ctx.baseURL,
    auth: { username: ctx.token, password: '' },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 60000,
  });

  client.interceptors.request.use(async (reqConfig) => {
    if (reqConfig.method === 'post') {
      const throttler = ctx._sharedThrottler || ctx;
      const now = Date.now();
      const elapsed = now - throttler._lastPostTime;
      throttler._lastPostTime = now + Math.max(0, ctx._minRequestInterval - elapsed);
      if (elapsed < ctx._minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, ctx._minRequestInterval - elapsed));
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
        if (cfg._retryCount <= ctx._maxRetries) {
          const delay = ctx._baseDelay * Math.pow(2, cfg._retryCount - 1);
          logger.warn(`Rate limited (${status}), retry ${cfg._retryCount}/${ctx._maxRetries} in ${(delay / 1000).toFixed(1)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return client(cfg);
        }
        logger.error(`Rate limited (${status}), exhausted all ${ctx._maxRetries} retries`);
      }
      return handleApiError(error, ctx.baseURL);
    }
  );

  return client;
}
