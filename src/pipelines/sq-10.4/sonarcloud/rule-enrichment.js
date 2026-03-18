import logger from '../../../shared/utils/logger.js';

/**
 * Build a rule enrichment map from SonarCloud quality profiles.
 *
 * For each profile, fetches active rules with cleanCodeAttribute and impacts
 * fields. This is used to enrich rules extracted from SonarQube 9.9 (which
 * lacks the Clean Code taxonomy) with the exact data SonarCloud expects.
 *
 * @param {import('./api-client.js').SonarCloudClient} scClient
 * @param {Array} scProfiles - SonarCloud quality profiles (from getQualityProfiles())
 * @returns {Promise<Map<string, { cleanCodeAttribute: string, impacts: Array }>>}
 *          Map keyed by fully-qualified rule key (e.g., "javascript:S1234")
 */
export async function buildRuleEnrichmentMap(scClient, scProfiles) {
  logger.info('Building rule enrichment map from SonarCloud...');
  const enrichmentMap = new Map();

  for (const profile of scProfiles) {
    try {
      const rules = await scClient.getActiveRulesWithCleanCodeFields(profile.key);
      for (const rule of rules) {
        // rule.key is the fully-qualified key like "javascript:S1234"
        if (rule.key && !enrichmentMap.has(rule.key)) {
          enrichmentMap.set(rule.key, {
            cleanCodeAttribute: rule.cleanCodeAttribute || null,
            impacts: rule.impacts || []
          });
        }
      }
      logger.debug(`  Profile ${profile.name} (${profile.language}): ${rules.length} rules enriched`);
    } catch (error) {
      logger.warn(`Failed to fetch enrichment data for profile ${profile.name}: ${error.message}`);
      // Continue with other profiles — graceful degradation
    }
  }

  logger.info(`Rule enrichment map built: ${enrichmentMap.size} rules with Clean Code data`);
  return enrichmentMap;
}
