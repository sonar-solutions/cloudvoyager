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
 * @returns {Promise<number>} Number of portfolios created
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

  // Check for existing portfolios to avoid duplicates on re-runs
  const existingPortfolios = await client.listPortfolios(enterpriseId);
  const existingNames = new Set(existingPortfolios.map(p => p.name));

  // Build project key -> {id, branchId} mapping using a temporary portfolio
  const projectUuidMap = await buildProjectUuidMap(client, enterpriseId);

  // Phase 2: Create portfolios
  let created = 0;
  for (const portfolio of allPortfolios) {
    try {
      if (existingNames.has(portfolio.name)) {
        logger.info(`Portfolio "${portfolio.name}" already exists — skipping`);
        continue;
      }

      // Resolve project keys to UUIDs
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

      await client.createPortfolio({
        name: portfolio.name,
        enterpriseId,
        description: portfolio.description || '',
        selection: 'projects',
        projects: resolvedProjects
      });

      created++;
      logger.info(`Created portfolio: ${portfolio.name} (${resolvedProjects.length}/${portfolio.projects.length} projects matched)`);
    } catch (error) {
      logger.warn(`Failed to migrate portfolio "${portfolio.name}": ${error.message}`);
    }
  }

  logger.info(`Portfolio migration complete: ${created} created, ${allPortfolios.length - created} skipped`);
  return created;
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
