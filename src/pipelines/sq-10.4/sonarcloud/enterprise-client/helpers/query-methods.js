import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build enterprise query methods (resolve, selectable orgs/projects).
export function buildEnterpriseQueryMethods(client) {
  return {
    async resolveEnterpriseId(enterpriseKey) {
      logger.debug(`Resolving enterprise key: ${enterpriseKey}`);
      const response = await client.get('/enterprises', { params: { enterpriseKey } });
      const enterprises = response.data;
      if (!Array.isArray(enterprises) || enterprises.length === 0) throw new SonarCloudAPIError(`Enterprise not found: ${enterpriseKey}`);
      logger.info(`Resolved enterprise "${enterpriseKey}" -> ${enterprises[0].id}`);
      return enterprises[0].id;
    },
    async getSelectableOrganizations(portfolioId, pageSize = 50) {
      return paginateList(client, '/portfolio-organizations', { portfolioId, pageSize }, 'organizations');
    },
    async getSelectableProjects(portfolioId, organizationId, pageSize = 50) {
      return paginateList(client, '/portfolio-projects', { portfolioId, organizationId, pageSize }, 'projects');
    },
  };
}

async function paginateList(client, endpoint, params, dataKey) {
  const items = [];
  let pageIndex = 1;
  while (true) { // eslint-disable-line no-constant-condition
    const response = await client.get(endpoint, { params: { ...params, pageIndex } });
    const page = response.data;
    items.push(...(page[dataKey] || []));
    if (items.length >= (page.page?.total || 0)) break;
    pageIndex++;
  }
  return items;
}
