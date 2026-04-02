import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency/helpers/map-concurrent.js';
import { EnterpriseClient } from '../../../enterprise-client.js';
import { buildProjectUuidMap } from './build-project-uuid-map.js';
import { resolvePortfolioProjects } from './resolve-portfolio-projects.js';
import { createOrUpdatePortfolio } from './create-or-update-portfolio.js';

// -------- Migrate Portfolios --------

/** Migrate portfolios from SonarQube to SonarCloud via Enterprise V2 API. */
export async function migratePortfolios(allPortfolios, projectKeyMapping, enterpriseConfig, orgConfig, rateLimitConfig) {
  if (!enterpriseConfig?.key) { logger.warn('No enterprise key configured — skipping portfolio migration'); return 0; }
  if (allPortfolios.length === 0) { logger.info('No portfolios to migrate'); return 0; }

  logger.info(`Migrating ${allPortfolios.length} portfolios via Enterprise V2 API`);
  const client = new EnterpriseClient({ url: orgConfig.url || 'https://sonarcloud.io', token: orgConfig.token, rateLimit: rateLimitConfig });
  const enterpriseId = await client.resolveEnterpriseId(enterpriseConfig.key);
  const existingPortfolios = await client.listPortfolios(enterpriseId);
  const existingByName = new Map(existingPortfolios.map(p => [p.name, p]));
  const projectUuidMap = await buildProjectUuidMap(client, enterpriseId);

  const results = await mapConcurrent(allPortfolios, async (portfolio) => {
    try {
      const resolvedProjects = resolvePortfolioProjects(portfolio, projectKeyMapping, projectUuidMap);
      return await createOrUpdatePortfolio(client, portfolio, resolvedProjects, existingByName.get(portfolio.name), enterpriseId);
    } catch (error) {
      logger.warn(`Failed to migrate portfolio "${portfolio.name}": ${error.message}`);
      return null;
    }
  }, { concurrency: 5, settled: true });
  const created = results.filter(r => r.status === 'fulfilled' && r.value === 'created').length;
  const updated = results.filter(r => r.status === 'fulfilled' && r.value === 'updated').length;

  logger.info(`Portfolio migration complete: ${created} created, ${updated} updated, ${allPortfolios.length - created - updated} skipped`);
  return created + updated;
}
