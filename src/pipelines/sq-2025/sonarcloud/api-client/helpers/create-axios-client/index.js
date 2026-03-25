import axios from 'axios';
import { attachRetryInterceptor } from './helpers/attach-retry-interceptor.js';

// -------- Create Axios Client --------

/** Create a configured Axios instance with rate limiting and retry interceptors. */
export function createAxiosClient(baseURL, token, rateLimit, sharedThrottler, state) {
  const client = axios.create({
    baseURL,
    auth: { username: token, password: '' },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 60000,
  });

  // POST throttle interceptor
  client.interceptors.request.use(async (reqConfig) => {
    if (reqConfig.method === 'post') {
      const throttler = sharedThrottler || state;
      const now = Date.now();
      const elapsed = now - throttler._lastPostTime;
      throttler._lastPostTime = now + Math.max(0, state._minRequestInterval - elapsed);
      if (elapsed < state._minRequestInterval) {
        await new Promise(resolve => setTimeout(resolve, state._minRequestInterval - elapsed));
      }
    }
    return reqConfig;
  });

  attachRetryInterceptor(client, state, baseURL);
  return client;
}
