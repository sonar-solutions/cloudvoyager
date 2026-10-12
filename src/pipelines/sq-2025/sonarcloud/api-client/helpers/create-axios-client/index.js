import axios from 'axios';
import { attachRetryInterceptor } from './helpers/attach-retry-interceptor.js';

// -------- Create Axios Client --------

/**
 * Create a configured Axios instance with rate limiting and retry interceptors.
 *
 * @param {object} params
 * @param {string} params.baseURL
 * @param {string|string[]} params.token - Single token or array of tokens for round-robin rotation
 * @param {object} params.rateLimit
 * @param {object} params.sharedThrottler
 * @param {object} params.state
 */
export function createAxiosClient({ baseURL, token, rateLimit, sharedThrottler, state }) {
  const tokens = Array.isArray(token) ? token : [token];
  const tokenPool = tokens.length > 1 ? tokens : null;

  const client = axios.create({
    baseURL,
    auth: { username: tokens[0], password: '' },
    headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    timeout: 60000,
  });

  // Token rotation interceptor — runs first to set auth before request fires
  if (tokenPool) {
    client.interceptors.request.use((reqConfig) => {
      reqConfig.auth = { username: tokenPool[Math.floor(Math.random() * tokenPool.length)], password: '' };
      return reqConfig;
    });
  }

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
