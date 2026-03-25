import logger from '../../../../../../shared/utils/logger.js';
import { resolvePortfolioProjects } from './resolve-portfolio-projects.js';

// -------- Create or Update Portfolios --------

export async function createOrUpdatePortfolios(allPortfolios, client, existingByName, projectKeyMapping, projectUuidMap) {
  let created = 0;
  let updated = 0;

  for (const portfolio of allPortfolios) {
    try {
      const resolvedProjects = resolvePortfolioProjects(portfolio, projectKeyMapping, projectUuidMap);
      const existing = existingByName.get(portfolio.name);

      if (existing) {
        if (existing.projects?.length === resolvedProjects.length && resolvedProjects.length === 0) {
          logger.info(`Portfolio "${portfolio.name}" already exists with no projects to add — skipping`);
          continue;
        }
        await client.updatePortfolio(existing.id, { name: portfolio.name, description: portfolio.description || '', selection: 'projects', projects: resolvedProjects });
        updated++;
        logger.info(`Updated portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
      } else {
        await client.createPortfolio({ name: portfolio.name, enterpriseId: existing ? undefined : portfolio._enterpriseId, description: portfolio.description || '', selection: 'projects', projects: resolvedProjects });
        created++;
        logger.info(`Created portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
      }
    } catch (error) { logger.warn(`Failed to migrate portfolio "${portfolio.name}": ${error.message}`); }
  }

  return { created, updated };
}
