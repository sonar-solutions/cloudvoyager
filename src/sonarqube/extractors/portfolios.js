import logger from '../../utils/logger.js';

/**
 * Extract all portfolios with project membership and configuration
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<Array>} Portfolios with details
 */
export async function extractPortfolios(client) {
  const portfolios = await client.getPortfolios();
  logger.info(`Found ${portfolios.length} portfolios`);

  if (portfolios.length === 0) {
    return [];
  }

  const detailed = [];
  for (const portfolio of portfolios) {
    const details = await client.getPortfolioDetails(portfolio.key);

    if (details) {
      detailed.push({
        key: portfolio.key,
        name: portfolio.name,
        description: portfolio.desc || portfolio.description || '',
        qualifier: portfolio.qualifier,
        visibility: portfolio.visibility || 'public',
        projects: (details.projects || details.selectedProjects || []).map(p => ({
          key: p.key || p.projectKey,
          name: p.name,
          selectedBranches: p.selectedBranches || []
        })),
        subViews: details.subViews || []
      });
    } else {
      detailed.push({
        key: portfolio.key,
        name: portfolio.name,
        description: portfolio.desc || portfolio.description || '',
        qualifier: portfolio.qualifier,
        visibility: portfolio.visibility || 'public',
        projects: [],
        subViews: []
      });
    }
  }

  return detailed;
}
