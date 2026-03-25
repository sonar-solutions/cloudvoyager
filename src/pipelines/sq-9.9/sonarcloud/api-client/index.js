import { createAxiosClient } from './helpers/create-axios-client.js';
import { attachRetryInterceptor } from './helpers/attach-retry-interceptor.js';
import * as core from './helpers/core-methods.js';
import * as analysis from './helpers/wait-for-analysis.js';
import { bindQueryMethods } from './helpers/bind-query-methods.js';
import { bindDelegateMethods } from './helpers/delegate-methods.js';

// -------- SonarCloud Client Factory + Class --------

export function createSonarCloudClient(config) {
  const { client, maxRetries, baseDelay } = createAxiosClient(config);
  const baseURL = config.url.replace(/\/$/, '');
  attachRetryInterceptor(client, maxRetries, baseDelay, baseURL);

  const ctx = { client, baseURL, token: config.token, organization: config.organization, projectKey: config.projectKey };

  return {
    ...ctx,
    handleError: (err) => core.handleError(err, baseURL),
    testConnection: () => core.testConnection(ctx),
    projectExists: () => core.projectExists(ctx),
    isProjectKeyTakenGlobally: (pk) => core.isProjectKeyTakenGlobally(ctx, pk),
    ensureProject: (name) => core.ensureProject(ctx, name),
    getMostRecentCeTask: () => core.getMostRecentCeTask(ctx),
    getAnalysisStatus: (id) => analysis.getAnalysisStatus(ctx, id),
    waitForAnalysis: (id, max) => analysis.waitForAnalysis(ctx, id, max),
    ...bindQueryMethods(ctx),
    ...bindDelegateMethods(ctx),
  };
}

export class SonarCloudClient {
  constructor(config) {
    const instance = createSonarCloudClient(config);
    Object.assign(this, instance);
  }
}
