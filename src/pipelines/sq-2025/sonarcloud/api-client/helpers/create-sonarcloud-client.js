import { createAxiosClient } from './create-axios-client.js';
import { testConnection, projectExists, ensureProject } from './project-methods.js';
import { isProjectKeyTakenGlobally } from './project-key-check.js';
import { getMostRecentCeTask, getAnalysisStatus, waitForAnalysis } from './ce-task-methods.js';
import { attachProfileMethods } from './attach-profile-methods.js';
import { attachGateMethods } from './attach-gate-methods.js';
import { attachIssueMethods } from './attach-issue-methods.js';
import { attachPermMethods } from './attach-perm-methods.js';
import { attachQueryMethods } from './attach-query-methods.js';

// -------- Create SonarCloud Client --------

/** Factory function that creates a SonarCloudClient instance. */
export function createSonarCloudClient(config) {
  const baseURL = config.url.replace(/\/$/, '');
  const rl = config.rateLimit || {};
  const state = {
    _maxRetries: rl.maxRetries ?? 3,
    _baseDelay: rl.baseDelay ?? 1000,
    _minRequestInterval: rl.minRequestInterval ?? 0,
    _lastPostTime: 0,
  };

  // Support both single token (string) and multiple tokens (string[])
  const tokens = config.tokens
    ? config.tokens
    : config.token
      ? [config.token]
      : [config.scToken].filter(Boolean);

  const client = createAxiosClient({
    baseURL,
    token: tokens,
    rateLimit: rl,
    sharedThrottler: config.sharedThrottler || null,
    state,
  });

  const inst = {
    baseURL,
    token: tokens[0],
    tokens: tokens.length > 1 ? tokens : null,
    organization: config.organization,
    projectKey: config.projectKey,
    client,
    _sharedThrottler: config.sharedThrottler || null,
    testConnection: () => testConnection(client, config.organization),
    projectExists: () => projectExists(client, config.projectKey, config.organization),
    isProjectKeyTakenGlobally: (pk) => isProjectKeyTakenGlobally(client, pk),
    ensureProject: (name = null) => ensureProject(client, config.projectKey, config.organization, name),
    getMostRecentCeTask: () => getMostRecentCeTask(client, config.projectKey),
    getAnalysisStatus: (id) => getAnalysisStatus(client, id),
    waitForAnalysis: (id, max = 300) => waitForAnalysis(client, id, max),
  };

  attachProfileMethods(inst, client, config.organization, config.projectKey);
  attachGateMethods(inst, client, config.organization);
  attachIssueMethods(inst, client, config.organization);
  attachPermMethods(inst, client, config.organization, config.projectKey);
  attachQueryMethods(inst, client, config.organization, config.projectKey);

  return inst;
}
