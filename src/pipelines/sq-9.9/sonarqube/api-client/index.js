import { createAxiosClient } from './helpers/create-axios-client.js';
import { getPaginated } from './helpers/get-paginated.js';
import * as core from './helpers/core-methods.js';
import * as data from './helpers/data-methods.js';
import * as measures from './helpers/measures-methods.js';
import * as analysis from './helpers/analysis-methods.js';
import { bindDelegateMethods } from './helpers/bind-delegate-methods.js';

// -------- SonarQube Client — Dual Export (Factory + Class) --------

export function createSonarQubeClient(config) {
  const { client, baseURL, token, projectKey } = createAxiosClient(config);
  const paginate = (ep, params, dk) => getPaginated(client, ep, params, dk);

  return {
    client, baseURL, token, projectKey,
    getPaginated: paginate,
    testConnection: () => core.testConnection(client),
    getServerVersion: () => core.getServerVersion(client),
    getProject: () => core.getProject(client, projectKey),
    getBranches: (pk) => core.getBranches(client, pk || projectKey),
    getQualityGate: () => core.getQualityGate(client, projectKey),
    getMetrics: () => data.getMetrics(paginate),
    getSourceCode: (fk, br) => data.getSourceCode(client, fk, br),
    getSourceFiles: (br) => data.getSourceFiles(paginate, projectKey, br),
    getQualityProfiles: () => data.getQualityProfiles(client, projectKey),
    getActiveRules: (pk) => data.getActiveRules(paginate, pk),
    getDuplications: (ck, br) => data.getDuplications(client, ck, br),
    getMeasures: (br, mk) => measures.getMeasures(client, projectKey, br, mk),
    getComponentTree: (br, mk) => measures.getComponentTree(paginate, client, projectKey, br, mk),
    getLatestAnalysisRevision: () => analysis.getLatestAnalysisRevision(client, projectKey),
    listAllProjects: () => analysis.listAllProjects(paginate),
    ...bindDelegateMethods(client, paginate, projectKey),
  };
}

export class SonarQubeClient {
  constructor(config) { Object.assign(this, createSonarQubeClient(config)); }
}
