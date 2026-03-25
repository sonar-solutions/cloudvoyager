import { createEnterpriseAxios } from './helpers/create-enterprise-axios.js';
import * as api from './helpers/enterprise-api-methods.js';
import * as paginated from './helpers/enterprise-paginated.js';

// -------- EnterpriseClient — Dual Export (Factory + Class) --------

export function createEnterpriseClient(config) {
  const { client, baseURL, token } = createEnterpriseAxios(config);
  return {
    client, baseURL, token,
    resolveEnterpriseId: (key) => api.resolveEnterpriseId(client, key),
    listPortfolios: (eid, ps) => paginated.listPortfolios(client, eid, ps),
    createPortfolio: (opts) => api.createPortfolio(client, opts),
    updatePortfolio: (pid, opts) => api.updatePortfolio(client, pid, opts),
    deletePortfolio: (pid) => api.deletePortfolio(client, pid),
    getSelectableOrganizations: (pid, ps) => paginated.getSelectableOrganizations(client, pid, ps),
    getSelectableProjects: (pid, oid, ps) => paginated.getSelectableProjects(client, pid, oid, ps),
  };
}

export class EnterpriseClient {
  constructor(config) { Object.assign(this, createEnterpriseClient(config)); }
}
