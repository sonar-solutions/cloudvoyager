import logger from '../../utils/logger.js';

/**
 * Migrate portfolios from SonarQube to SonarCloud
 * @param {Array} extractedPortfolios - Portfolios extracted from SonarQube
 * @param {Map<string, string>} projectKeyMapping - SQ project key -> SC project key
 * @param {import('../api-client.js').SonarCloudClient} client - SonarCloud client
 * @returns {Promise<Map<string, string>>} Mapping of SQ portfolio key -> SC portfolio key
 */
export async function migratePortfolios(extractedPortfolios, projectKeyMapping, client) {
  const portfolioMapping = new Map();

  logger.info(`Migrating ${extractedPortfolios.length} portfolios`);

  for (const portfolio of extractedPortfolios) {
    try {
      // Create portfolio
      const created = await client.createPortfolio(
        portfolio.name,
        portfolio.description,
        portfolio.visibility,
        portfolio.key
      );

      const scKey = created.key || portfolio.key;
      portfolioMapping.set(portfolio.key, scKey);

      // Add projects to portfolio
      for (const project of portfolio.projects) {
        const scProjectKey = projectKeyMapping.get(project.key) || project.key;
        try {
          await client.addProjectToPortfolio(scKey, scProjectKey);
          logger.debug(`Added project ${scProjectKey} to portfolio ${portfolio.name}`);
        } catch (error) {
          logger.debug(`Failed to add project ${scProjectKey} to portfolio: ${error.message}`);
        }
      }

      logger.info(`Migrated portfolio: ${portfolio.name} (${portfolio.projects.length} projects)`);
    } catch (error) {
      logger.warn(`Failed to migrate portfolio ${portfolio.name}: ${error.message}`);
    }
  }

  return portfolioMapping;
}
