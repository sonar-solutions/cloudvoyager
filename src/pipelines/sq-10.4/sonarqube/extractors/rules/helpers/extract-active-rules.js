import logger from '../../../../../../shared/utils/logger.js';
import { detectUsedLanguages } from './detect-used-languages.js';
import { extractRulesFromProfiles } from './extract-rules-from-profiles.js';
import { logRuleBreakdown } from './log-rule-breakdown.js';

// -------- Main Logic --------

// Extract active rules from quality profiles for a project.
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
