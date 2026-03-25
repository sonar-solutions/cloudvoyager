import axios from 'axios';
import logger from '../../../../../shared/utils/logger.js';

// -------- Create Axios Client with Rate Limiting + Retry Interceptors --------

export function createAxiosClient(config) {
  const rateLimit = config.rateLimit || {};
  const maxRetries = rateLimit.maxRetries ?? 3;
  const baseDelay = rateLimit.baseDelay ?? 1000;
  const minRequestInterval = rateLimit.minRequestInterval ?? 0;
  const throttler = config.sharedThrottler || { _lastPostTime: 0 };

  const client = axios.create({
    baseURL: config.url.replace(/\/$/, ''),
    auth: { username: config.token, password: '' },
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    timeout: 60000,
  });

  // POST throttling interceptor
  client.interceptors.request.use(async (reqConfig) => {
    if (reqConfig.method === 'post') {
      const now = Date.now();
      const elapsed = now - throttler._lastPostTime;
      throttler._lastPostTime = now + Math.max(0, minRequestInterval - elapsed);
      if (elapsed < minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, minRequestInterval - elapsed));
      }
    }
    return reqConfig;
  });

  return { client, maxRetries, baseDelay };
}
