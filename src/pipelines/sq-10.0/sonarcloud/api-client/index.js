import { createHttpClient } from './helpers/create-http-client.js';
import { handleApiError } from './helpers/handle-api-error.js';
import * as conn from './helpers/connection-methods.js';
import * as ce from './helpers/ce-methods.js';
import { bindQueryMethods } from './helpers/bind-query-methods.js';
import { bindDelegatedMethods } from './helpers/delegated-api-methods.js';

// -------- Factory Function --------

export function createSonarCloudClient(config) {
  const rateLimit = config.rateLimit || {};
  const ctx = {
    baseURL: config.url.replace(/\/$/, ''), token: config.token,
    organization: config.organization, projectKey: config.projectKey,
    _maxRetries: rateLimit.maxRetries ?? 3, _baseDelay: rateLimit.baseDelay ?? 1000,
    _minRequestInterval: rateLimit.minRequestInterval ?? 0, _lastPostTime: 0,
    _sharedThrottler: config.sharedThrottler || null,
  };
  ctx.client = createHttpClient(ctx);
  const c = ctx.client;
  const o = ctx.organization;
  const pk = ctx.projectKey;
  return {
    ...ctx, handleError: (err) => handleApiError(err, ctx.baseURL),
    testConnection: () => conn.testConnection(c, o),
    projectExists: () => conn.projectExists(c, pk, o),
    isProjectKeyTakenGlobally: (key) => conn.isProjectKeyTakenGlobally(c, key),
    ensureProject: (name) => conn.ensureProject(c, pk, o, name),
    getMostRecentCeTask: () => ce.getMostRecentCeTask(c, pk),
    getAnalysisStatus: (id) => ce.getAnalysisStatus(c, id),
    waitForAnalysis: (id, max) => ce.waitForAnalysis(c, id, max),
    ...bindQueryMethods(c, o, pk),
    ...bindDelegatedMethods(ctx),
  };
}

// -------- Class Wrapper (backward compat) --------

export class SonarCloudClient {
  constructor(config) {
    Object.assign(this, createSonarCloudClient(config));
  }
}
