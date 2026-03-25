import logger from '../../../../../shared/utils/logger.js';
import { EnterpriseClient } from '../../enterprise-client.js';
import { buildProjectUuidMap } from './helpers/build-project-uuid-map.js';
import { resolvePortfolioProjects } from './helpers/resolve-portfolio-projects.js';
import { applyPortfolio } from './helpers/apply-portfolio.js';

// -------- Migrate Portfolios via Enterprise V2 API --------

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

  const enterpriseId = await client.resolveEnterpriseId(enterpriseConfig.key);
  const existingPortfolios = await client.listPortfolios(enterpriseId);
  const existingByName = new Map(existingPortfolios.map(p => [p.name, p]));
  const projectUuidMap = await buildProjectUuidMap(client, enterpriseId);

  let created = 0;
  let updated = 0;
  for (const portfolio of allPortfolios) {
    try {
      const resolved = resolvePortfolioProjects(portfolio, projectKeyMapping, projectUuidMap);
      const existing = existingByName.get(portfolio.name);
      const result = await applyPortfolio(client, portfolio, resolved, existing, enterpriseId);
      if (result === 'created') created++;
      else if (result === 'updated') updated++;
    } catch (error) {
      logger.warn(`Failed to migrate portfolio "${portfolio.name}": ${error.message}`);
    }
  }

  logger.info(`Portfolio migration complete: ${created} created, ${updated} updated, ${allPortfolios.length - created - updated} skipped`);
  return created + updated;
}

export { resolvePortfolioProjects, buildProjectUuidMap };
