import { createHttpClient } from './helpers/create-http-client.js';
import { handleError } from './helpers/handle-error.js';
import { getPaginated } from './helpers/get-paginated.js';
import * as proj from './helpers/project-methods.js';
import * as meas from './helpers/measure-methods.js';
import * as tree from './helpers/component-tree-methods.js';
import * as anal from './helpers/analysis-methods.js';
import * as conn from './helpers/connection-methods.js';
import * as prof from './helpers/profile-methods.js';
import { bindDelegatedMethods } from './helpers/bind-delegated-methods.js';

// -------- Factory Function --------

export function createSonarQubeClient(config) {
  const baseURL = config.url.replace(/\/$/, '');
  const pk = config.projectKey;
  const errHandler = (err) => handleError(err, baseURL);
  const client = createHttpClient(baseURL, config.token, errHandler);
  const paginate = (ep, p, dk) => getPaginated(client, ep, p, dk);
  return {
    baseURL, token: config.token, projectKey: pk, client,
    handleError: errHandler,
    getPaginated: paginate,
    getProject: () => proj.getProject(client, pk),
    getBranches: (p = null) => proj.getBranches(client, p || pk),
    getSourceCode: (f, b = null) => proj.getSourceCode(client, f, b),
    getSourceFiles: (b = null) => proj.getSourceFiles(client, pk, b),
    listAllProjects: () => proj.listAllProjects(client),
    getMetrics: () => meas.getMetrics(client),
    getMeasures: (b = null, mk = []) => meas.getMeasures(client, pk, b, mk),
    getComponentTree: (b = null, mk = []) => tree.getComponentTree(client, pk, b, mk),
    getQualityGate: () => anal.getQualityGate(client, pk),
    getLatestAnalysisRevision: () => anal.getLatestAnalysisRevision(client, pk),
    getDuplications: (ck, b = null) => anal.getDuplications(client, ck, b),
    testConnection: () => conn.testConnection(client),
    getServerVersion: () => conn.getServerVersion(client),
    getQualityProfiles: () => prof.getQualityProfiles(client, pk),
    getActiveRules: (p) => prof.getActiveRules(client, p),
    ...bindDelegatedMethods(client, paginate, pk),
  };
}

// -------- Class Wrapper (backward compat) --------

export class SonarQubeClient {
  constructor(config) {
    Object.assign(this, createSonarQubeClient(config));
  }
}
