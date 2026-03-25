import logger from '../../../../../shared/utils/logger.js';
import { SonarCloudAPIError } from '../../../../../shared/utils/errors.js';

// -------- Enterprise Methods --------

export function bindEnterpriseMethods(ctx) {
  ctx.resolveEnterpriseId = async (enterpriseKey) => {
    logger.debug(`Resolving enterprise key: ${enterpriseKey}`);
    const response = await ctx.client.get('/enterprises', { params: { enterpriseKey } });
    const enterprises = response.data;
    if (!Array.isArray(enterprises) || enterprises.length === 0) throw new SonarCloudAPIError(`Enterprise not found: ${enterpriseKey}`);
    const id = enterprises[0].id;
    logger.info(`Resolved enterprise "${enterpriseKey}" -> ${id}`);
    return id;
  };

  ctx.createPortfolio = async ({ name, enterpriseId, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) => {
    logger.info(`Creating enterprise portfolio: ${name}`);
    const response = await ctx.client.post('/portfolios', { name, enterpriseId, description, selection, projects, tags, organizationIds });
    return response.data;
  };

  ctx.updatePortfolio = async (portfolioId, { name, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) => {
    logger.info(`Updating enterprise portfolio: ${name} (${portfolioId})`);
    const response = await ctx.client.patch(`/portfolios/${portfolioId}`, { name, description, selection, projects, tags, organizationIds });
    return response.data;
  };

  ctx.deletePortfolio = async (portfolioId) => {
    logger.debug(`Deleting portfolio: ${portfolioId}`);
    await ctx.client.delete(`/portfolios/${portfolioId}`);
  };
}
