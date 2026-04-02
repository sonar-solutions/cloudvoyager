import logger from '../../../../../../shared/utils/logger.js';

// -------- Apply One Portfolio --------

/** Create or update a single portfolio. Returns 'created', 'updated', or 'skipped'. */
export async function applyOnePortfolio(client, portfolio, resolvedProjects, existing, enterpriseId) {
  try {
    if (existing) {
      if (existing.projects?.length === resolvedProjects.length && resolvedProjects.length === 0) {
        logger.info(`Portfolio "${portfolio.name}" already exists — skipping`);
        return 'skipped';
      }
      const payload = { name: portfolio.name, description: portfolio.description || '', selection: 'projects', projects: resolvedProjects };
      await client.updatePortfolio(existing.id, payload);
      logger.info(`Updated portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
      return 'updated';
    }
    const payload = { name: portfolio.name, enterpriseId, description: portfolio.description || '', selection: 'projects', projects: resolvedProjects };
    await client.createPortfolio(payload);
    logger.info(`Created portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
    return 'created';
  } catch (error) {
    logger.warn(`Failed to migrate portfolio "${portfolio.name}": ${error.message}`);
    return null;
  }
}
