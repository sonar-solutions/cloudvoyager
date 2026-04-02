import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../shared/utils/concurrency/helpers/map-concurrent.js';
import { EnterpriseClient } from '../../../sonarcloud/enterprise-client.js';
import { buildProjectUuidMap } from './helpers/build-project-uuid-map.js';
import { resolvePortfolioProjects } from './helpers/resolve-portfolio-projects.js';
import { applyOnePortfolio } from './helpers/apply-one-portfolio.js';

// -------- Migrate Portfolios --------

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
    const resolvedProjects = resolvePortfolioProjects(portfolio, projectKeyMapping, projectUuidMap);
    const existing = existingByName.get(portfolio.name);
    return await applyOnePortfolio(client, portfolio, resolvedProjects, existing, enterpriseId);
  }, { concurrency: 5, settled: true });
  const created = results.filter(r => r.status === 'fulfilled' && r.value === 'created').length;
  const updated = results.filter(r => r.status === 'fulfilled' && r.value === 'updated').length;

  logger.info(`Portfolio migration complete: ${created} created, ${updated} updated, ${allPortfolios.length - created - updated} skipped`);
  return created + updated;
}
