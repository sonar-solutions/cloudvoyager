import { buildRuleEnrichmentMap } from '../../../sonarcloud/rule-enrichment.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Ensure Rule Enrichment Map is Built --------

export async function ensureRuleEnrichment(ctx, scClient) {
  if (ctx.ruleEnrichmentMap) return;

  logger.info('SonarQube 9.9 does not support Clean Code taxonomy. Building enrichment map from SonarCloud...');
  try {
    const scProfiles = await scClient.getQualityProfiles();
    ctx.ruleEnrichmentMap = await buildRuleEnrichmentMap(scClient, scProfiles);
  } catch (error) {
    logger.warn(`Failed to build rule enrichment map: ${error.message}. Falling back to type-based inference.`);
    ctx.ruleEnrichmentMap = new Map();
  }
}
