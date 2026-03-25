import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- Portfolio Methods --------

/** Attach portfolio CRUD methods to the enterprise client instance. */
export function attachPortfolioMethods(inst) {
  inst.resolveEnterpriseId = async (enterpriseKey) => {
    logger.debug(`Resolving enterprise key: ${enterpriseKey}`);
    const response = await inst.client.get('/enterprises', { params: { enterpriseKey } });
    const enterprises = response.data;
    if (!Array.isArray(enterprises) || enterprises.length === 0) throw new SonarCloudAPIError(`Enterprise not found: ${enterpriseKey}`);
    logger.info(`Resolved enterprise "${enterpriseKey}" -> ${enterprises[0].id}`);
    return enterprises[0].id;
  };

  inst.createPortfolio = async ({ name, enterpriseId, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) => {
    logger.info(`Creating enterprise portfolio: ${name}`);
    const response = await inst.client.post('/portfolios', { name, enterpriseId, description, selection, projects, tags, organizationIds });
    return response.data;
  };

  inst.updatePortfolio = async (portfolioId, { name, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) => {
    logger.info(`Updating enterprise portfolio: ${name} (${portfolioId})`);
    const response = await inst.client.patch(`/portfolios/${portfolioId}`, { name, description, selection, projects, tags, organizationIds });
    return response.data;
  };

  inst.deletePortfolio = async (portfolioId) => {
    logger.debug(`Deleting portfolio: ${portfolioId}`);
    await inst.client.delete(`/portfolios/${portfolioId}`);
  };
}
