import { buildRuleEnrichmentMap } from '../../sonarcloud/rule-enrichment.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Fetch SonarCloud Profiles, Repos, and Rule Enrichment --------

export async function fetchCloudContext(sonarCloudClient, prebuiltEnrichmentMap) {
  logger.info('Fetching SonarCloud quality profiles...');
  const sonarCloudProfiles = await sonarCloudClient.getQualityProfiles();
  const sonarCloudMainBranch = await sonarCloudClient.getMainBranchName();

  logger.info('Fetching SonarCloud rule repositories...');
  const sonarCloudRepos = await sonarCloudClient.getRuleRepositories();

  let ruleEnrichmentMap = prebuiltEnrichmentMap || new Map();
  if (!prebuiltEnrichmentMap) {
    logger.info('SonarQube 9.9 does not support Clean Code taxonomy. Fetching enrichment from SonarCloud...');
    try {
      ruleEnrichmentMap = await buildRuleEnrichmentMap(sonarCloudClient, sonarCloudProfiles);
    } catch (error) {
      logger.warn(`Failed to build rule enrichment map: ${error.message}. Falling back to type-based inference.`);
    }
  }

  return { sonarCloudProfiles, sonarCloudMainBranch, sonarCloudRepos, ruleEnrichmentMap };
}
