import { migratePortfolios } from '../../../sonarcloud/migrators/portfolios.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Migrate Enterprise Portfolios --------

export async function migrateEnterprisePortfolios(extractedData, mergedProjectKeyMap, results, ctx) {
  const enterpriseConfig = ctx.enterpriseConfig;
  if (!enterpriseConfig?.key) {
    logger.info('No enterprise key configured — skipping portfolio migration');
    return;
  }

  const allPortfolios = extractedData.portfolios || [];
  if (allPortfolios.length === 0) { logger.info('No portfolios to migrate'); return; }

  if (ctx.onlyComponents?.includes('portfolios')) {
    logger.warn('Note: --only portfolios requires that projects are already migrated to SonarCloud.');
    logger.warn('If projects have not been migrated yet, portfolio creation may fail or produce empty portfolios.');
  }

  const start = Date.now();
  try {
    logger.info('Creating portfolios via Enterprise V2 API...');
    const orgConfig = ctx.sonarcloudOrgs[0];
    const created = await migratePortfolios(allPortfolios, mergedProjectKeyMap, enterpriseConfig, orgConfig, ctx.rateLimitConfig);
    results.portfolios += created;
    logger.info(`Enterprise portfolios: ${created} created`);
  } catch (error) {
    logger.error(`Failed to create enterprise portfolios: ${error.message}`);
  }
  logger.debug(`Portfolio migration took ${Date.now() - start}ms`);
}
