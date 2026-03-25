import logger from '../../../../../../shared/utils/logger.js';
import { resolvePortfolioProjects } from './resolve-portfolio-projects.js';

// -------- Main Logic --------

// Create or update a single portfolio in SonarCloud.
export async function createOrUpdatePortfolio(portfolio, client, existingByName, projectKeyMapping, projectUuidMap, enterpriseId) {
  try {
    const resolvedProjects = resolvePortfolioProjects(portfolio, projectKeyMapping, projectUuidMap);
    const existing = existingByName.get(portfolio.name);

    if (existing) {
      if (existing.projects?.length === resolvedProjects.length && resolvedProjects.length === 0) {
        logger.info(`Portfolio "${portfolio.name}" already exists with no projects to add — skipping`);
        return 'skipped';
      }
      await client.updatePortfolio(existing.id, { name: portfolio.name, description: portfolio.description || '', selection: 'projects', projects: resolvedProjects });
      logger.info(`Updated portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
      return 'updated';
    }

    await client.createPortfolio({ name: portfolio.name, enterpriseId, description: portfolio.description || '', selection: 'projects', projects: resolvedProjects });
    logger.info(`Created portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
    return 'created';
  } catch (error) {
    logger.warn(`Failed to migrate portfolio "${portfolio.name}": ${error.message}`);
    return 'failed';
  }
}
