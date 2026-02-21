import logger from '../../utils/logger.js';
import { EnterpriseClient } from '../enterprise-client.js';

/**
 * Migrate portfolios from SonarQube to SonarCloud using the V2 Enterprise API.
 *
 * Portfolios in SonarCloud live at the Enterprise level (not organization level),
 * so we use the V2 API at https://api.{domain}/enterprises/.
 *
 * @param {Array} allPortfolios - All portfolios extracted from SonarQube
 * @param {Map<string, string>} projectKeyMapping - SQ project key -> SC project key
 * @param {object} enterpriseConfig - { key: 'enterprise-key' }
 * @param {object} orgConfig - First org config with { url, token } for API access
 * @param {object} rateLimitConfig - Rate limit settings
 * @returns {Promise<number>} Number of portfolios created or updated
 */
export async function migratePortfolios(allPortfolios, projectKeyMapping, enterpriseConfig, orgConfig, rateLimitConfig) {
  if (!enterpriseConfig?.key) {
    logger.warn('No enterprise key configured — skipping portfolio migration');
    return 0;
  }

  if (allPortfolios.length === 0) {
    logger.info('No portfolios to migrate');
    return 0;
  }

  logger.info(`Migrating ${allPortfolios.length} portfolios via Enterprise V2 API`);

  const client = new EnterpriseClient({
    url: orgConfig.url || 'https://sonarcloud.io',
    token: orgConfig.token,
    rateLimit: rateLimitConfig
  });

  // Phase 1: Resolve enterprise UUID and build project UUID mappings
  const enterpriseId = await client.resolveEnterpriseId(enterpriseConfig.key);

  // Check for existing portfolios so we can update them
  const existingPortfolios = await client.listPortfolios(enterpriseId);
  const existingByName = new Map(existingPortfolios.map(p => [p.name, p]));

  // Build project key -> {id, branchId} mapping using a temporary portfolio
  const projectUuidMap = await buildProjectUuidMap(client, enterpriseId);

  // Phase 2: Create or update portfolios
  let created = 0;
  let updated = 0;
  for (const portfolio of allPortfolios) {
    try {
      // Resolve project keys to UUIDs
      const resolvedProjects = resolvePortfolioProjects(portfolio, projectKeyMapping, projectUuidMap);

      const existing = existingByName.get(portfolio.name);
      if (existing) {
        // Portfolio already exists — update it with the resolved projects via PATCH
        if (existing.projects?.length === resolvedProjects.length && resolvedProjects.length === 0) {
          logger.info(`Portfolio "${portfolio.name}" already exists with no projects to add — skipping`);
          continue;
        }
        await client.updatePortfolio(existing.id, {
          name: portfolio.name,
          description: portfolio.description || '',
          selection: 'projects',
          projects: resolvedProjects
        });
        updated++;
        logger.info(`Updated portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
      } else {
        await client.createPortfolio({
          name: portfolio.name,
          enterpriseId,
          description: portfolio.description || '',
          selection: 'projects',
          projects: resolvedProjects
        });
        created++;
        logger.info(`Created portfolio: ${portfolio.name} (${resolvedProjects.length} projects)`);
      }
    } catch (error) {
      logger.warn(`Failed to migrate portfolio "${portfolio.name}": ${error.message}`);
    }
  }

  logger.info(`Portfolio migration complete: ${created} created, ${updated} updated, ${allPortfolios.length - created - updated} skipped`);
  return created + updated;
}

/**
 * Resolve a portfolio's projects to SonarCloud UUIDs.
 *
 * For portfolios with selectionMode "REST" (all projects), includes every
 * selectable project from the UUID map. For "MANUAL" portfolios, maps
 * only the explicitly listed projects.
 */
function resolvePortfolioProjects(portfolio, projectKeyMapping, projectUuidMap) {
  // "REST" selection mode means "all projects" in SonarQube
  if (portfolio.selectionMode === 'REST') {
    const allProjects = [...projectUuidMap.values()].map(u => ({ id: u.id, branchId: u.branchId }));
    logger.info(`Portfolio "${portfolio.name}" uses "all projects" mode — including all ${allProjects.length} selectable projects`);
    return allProjects;
  }

  const resolvedProjects = [];
  for (const project of portfolio.projects) {
    const scProjectKey = projectKeyMapping.get(project.key) || project.key;
    const uuids = projectUuidMap.get(scProjectKey);
    if (uuids) {
      resolvedProjects.push({ id: uuids.id, branchId: uuids.branchId });
    } else {
      logger.debug(`Portfolio "${portfolio.name}": project "${scProjectKey}" not found in SonarCloud — skipping`);
    }
  }
  return resolvedProjects;
}

/**
 * Build a map of SC project key -> { id, branchId } by creating a temporary
 * portfolio and querying the selectable projects for each organization.
 */
async function buildProjectUuidMap(client, enterpriseId) {
  const projectUuidMap = new Map();

  // Create a temporary portfolio to query selectable projects
  const tempPortfolio = await client.createPortfolio({
    name: `_cloudvoyager_temp_lookup_${Date.now()}`,
    enterpriseId,
    description: 'Temporary portfolio for UUID resolution (will be deleted)',
    selection: 'projects'
  });

  try {
    const orgs = await client.getSelectableOrganizations(tempPortfolio.id);
    logger.debug(`Found ${orgs.length} selectable organizations for project UUID resolution`);

    for (const org of orgs) {
      const projects = await client.getSelectableProjects(tempPortfolio.id, org.id);
      for (const project of projects) {
        projectUuidMap.set(project.projectKey, {
          id: project.id,
          branchId: project.branchId
        });
      }
      logger.debug(`Resolved ${projects.length} project UUIDs from org "${org.name}"`);
    }
  } finally {
    await client.deletePortfolio(tempPortfolio.id);
    logger.debug('Deleted temporary lookup portfolio');
  }

  logger.info(`Resolved ${projectUuidMap.size} project UUIDs for portfolio migration`);
  return projectUuidMap;
}
