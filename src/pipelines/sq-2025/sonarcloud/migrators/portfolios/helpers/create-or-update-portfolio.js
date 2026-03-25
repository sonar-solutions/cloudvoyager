import logger from '../../../../../../shared/utils/logger.js';

// -------- Create Or Update Portfolio --------

/** Create or update a single portfolio in SonarCloud. Returns 'created', 'updated', or 'skipped'. */
export async function createOrUpdatePortfolio(client, portfolio, resolvedProjects, existing, enterpriseId) {
  if (existing) {
    if (existing.projects?.length === resolvedProjects.length && resolvedProjects.length === 0) {
      logger.info(`Portfolio "${portfolio.name}" already exists with no projects to add — skipping`);
      return 'skipped';
    }
    await client.updatePortfolio(existing.id, {
      name: portfolio.name, description: portfolio.description || '',
      selection: 'projects', projects: resolvedProjects,
    });
    logger.info(`Updated portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
    return 'updated';
  }

  await client.createPortfolio({
    name: portfolio.name, enterpriseId, description: portfolio.description || '',
    selection: 'projects', projects: resolvedProjects,
  });
  logger.info(`Created portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
  return 'created';
}
