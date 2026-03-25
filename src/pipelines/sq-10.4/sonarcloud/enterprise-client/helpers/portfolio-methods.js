import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Build portfolio CRUD methods for the enterprise client.
export function buildPortfolioMethods(client) {
  return {
    async listPortfolios(enterpriseId, pageSize = 50) {
      const portfolios = [];
      let pageIndex = 1;
      while (true) { // eslint-disable-line no-constant-condition
        const response = await client.get('/portfolios', { params: { enterpriseId, pageSize, pageIndex } });
        const page = response.data;
        portfolios.push(...(page.portfolios || []));
        if (portfolios.length >= (page.page?.total || 0)) break;
        pageIndex++;
      }
      return portfolios;
    },
    async createPortfolio({ name, enterpriseId, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) {
      logger.info(`Creating enterprise portfolio: ${name}`);
      return (await client.post('/portfolios', { name, enterpriseId, description, selection, projects, tags, organizationIds })).data;
    },
    async updatePortfolio(portfolioId, { name, description = '', selection = 'projects', projects = [], tags = [], organizationIds = [] }) {
      logger.info(`Updating enterprise portfolio: ${name} (${portfolioId})`);
      return (await client.patch(`/portfolios/${portfolioId}`, { name, description, selection, projects, tags, organizationIds })).data;
    },
    async deletePortfolio(portfolioId) {
      logger.debug(`Deleting portfolio: ${portfolioId}`);
      await client.delete(`/portfolios/${portfolioId}`);
    },
  };
}
