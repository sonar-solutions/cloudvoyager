import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Enterprise API Methods --------

export async function resolveEnterpriseId(client, enterpriseKey) {
  logger.debug(`Resolving enterprise key: ${enterpriseKey}`);
  const response = await client.get('/enterprises', { params: { enterpriseKey } });
  const enterprises = response.data;
  if (!Array.isArray(enterprises) || enterprises.length === 0) {
    throw new SonarCloudAPIError(`Enterprise not found: ${enterpriseKey}`);
  }
  logger.info(`Resolved enterprise "${enterpriseKey}" -> ${enterprises[0].id}`);
  return enterprises[0].id;
}

export async function createPortfolio(client, { name, enterpriseId, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) {
  logger.info(`Creating enterprise portfolio: ${name}`);
  const response = await client.post('/portfolios', { name, enterpriseId, description, selection, projects, tags, organizationIds });
  return response.data;
}

export async function updatePortfolio(client, portfolioId, { name, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) {
  logger.info(`Updating enterprise portfolio: ${name} (${portfolioId})`);
  const response = await client.patch(`/portfolios/${portfolioId}`, { name, description, selection, projects, tags, organizationIds });
  return response.data;
}

export async function deletePortfolio(client, portfolioId) {
  logger.debug(`Deleting portfolio: ${portfolioId}`);
  await client.delete(`/portfolios/${portfolioId}`);
}
