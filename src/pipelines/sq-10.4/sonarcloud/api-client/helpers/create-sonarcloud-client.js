import { createHttpClient } from './create-http-client.js';
import { handleApiError } from './handle-api-error.js';
import { buildConnectionMethods } from './connection-methods.js';
import { buildCeMethods } from './ce-methods.js';
import { buildDelegateMethods } from './delegate-methods.js';
import { buildQueryMethods } from './query-methods.js';
import { buildExtendedQueryMethods } from './extended-query-methods.js';

// -------- Main Logic --------

/**
 * Factory function to create a SonarCloud API client.
 */
export function createSonarCloudClient(config) {
  const baseURL = config.url.replace(/\/$/, '');
  const rateLimit = config.rateLimit || {};
  const maxRetries = rateLimit.maxRetries ?? 3;
  const baseDelay = rateLimit.baseDelay ?? 1000;
  const minRequestInterval = rateLimit.minRequestInterval ?? 0;

  const errorHandler = (error) => handleApiError(error, baseURL);
  const { client, throttleState } = createHttpClient(baseURL, config.token, maxRetries, baseDelay, minRequestInterval, config.sharedThrottler || null, errorHandler);

  const instance = {
    baseURL, token: config.token, organization: config.organization,
    projectKey: config.projectKey, client,
    _lastPostTime: 0, _sharedThrottler: config.sharedThrottler || null,
    handleError: errorHandler,
    ...buildConnectionMethods(client, config.organization, config.projectKey),
    ...buildCeMethods(client, config.projectKey),
    ...buildDelegateMethods(client, config.organization, config.projectKey),
    ...buildQueryMethods(client, config.organization, config.projectKey),
    ...buildExtendedQueryMethods(client, config.organization, config.projectKey),
  };

  // Ensure `this` references work for methods that call other methods on the same object
  Object.keys(instance).forEach(key => {
    if (typeof instance[key] === 'function') {
      instance[key] = instance[key].bind(instance);
    }
  });

  return instance;
}
