import logger from '../../../../../../shared/utils/logger.js';
import { EnterpriseClient } from '../../../enterprise-client.js';
import { buildProjectUuidMap } from './build-project-uuid-map.js';
import { resolvePortfolioProjects } from './resolve-portfolio-projects.js';
import { createOrUpdatePortfolio } from './create-or-update-portfolio.js';

// -------- Main Logic --------

// Migrate portfolios from SonarQube to SonarCloud using the V2 Enterprise API.
export async function migratePortfolios(allPortfolios, projectKeyMapping, enterpriseConfig, orgConfig, rateLimitConfig) {
  if (!enterpriseConfig?.key) { logger.warn('No enterprise key configured — skipping portfolio migration'); return 0; }
  if (allPortfolios.length === 0) { logger.info('No portfolios to migrate'); return 0; }

  logger.info(`Migrating ${allPortfolios.length} portfolios via Enterprise V2 API`);
  const client = new EnterpriseClient({ url: orgConfig.url || 'https://sonarcloud.io', token: orgConfig.token, rateLimit: rateLimitConfig });

  const enterpriseId = await client.resolveEnterpriseId(enterpriseConfig.key);
  const existingPortfolios = await client.listPortfolios(enterpriseId);
  const existingByName = new Map(existingPortfolios.map(p => [p.name, p]));
  const projectUuidMap = await buildProjectUuidMap(client, enterpriseId);

  let created = 0, updated = 0;
  for (const portfolio of allPortfolios) {
    const result = await createOrUpdatePortfolio(portfolio, client, existingByName, projectKeyMapping, projectUuidMap, enterpriseId);
    if (result === 'created') created++;
    else if (result === 'updated') updated++;
  }

  logger.info(`Portfolio migration complete: ${created} created, ${updated} updated, ${allPortfolios.length - created - updated} skipped`);
  return created + updated;
}
