import { detectUsedLanguages } from './helpers/detect-used-languages.js';
import { extractRulesFromProfiles } from './helpers/extract-rules-from-profiles.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Extract Active Rules --------

/** Extract active rules from all quality profiles for the project. */
export async function extractActiveRules(client, components = []) {
  logger.info('Extracting active rules from quality profiles...');
  try {
    const usedLanguages = detectUsedLanguages(components);
    logger.info(`Project uses languages: ${Array.from(usedLanguages).join(', ')}`);
    const profiles = await client.getQualityProfiles();
    logger.info(`Found ${profiles.length} quality profiles`);
    if (profiles.length === 0) {
      logger.warn('No quality profiles found for project');
      return [];
    }
    const allActiveRules = await extractRulesFromProfiles(client, profiles, usedLanguages);
    logger.info(`Extracted ${allActiveRules.length} unique active rules`);
    logRuleBreakdown(allActiveRules);
    return allActiveRules;
  } catch (error) {
    logger.error(`Failed to extract active rules: ${error.message}`);
    throw error;
  }
}

function logRuleBreakdown(allActiveRules) {
  const repoCounts = {};
  allActiveRules.forEach(rule => {
    repoCounts[rule.ruleRepository] = (repoCounts[rule.ruleRepository] || 0) + 1;
  });
  logger.info('Active rules breakdown by repository:');
  Object.entries(repoCounts).forEach(([repo, count]) => {
    logger.info(`  ${repo}: ${count}`);
  });
}
