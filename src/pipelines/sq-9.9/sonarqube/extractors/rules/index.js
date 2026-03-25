import logger from '../../../../../shared/utils/logger.js';
import { detectUsedLanguages } from './helpers/detect-used-languages.js';
import { extractRulesFromProfiles } from './helpers/extract-rules-from-profiles.js';
import { logRuleBreakdown } from './helpers/log-rule-breakdown.js';

// -------- Extract Active Rules --------

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
