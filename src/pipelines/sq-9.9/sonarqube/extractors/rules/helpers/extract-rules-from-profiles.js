import logger from '../../../../../../shared/utils/logger.js';
import { buildActiveRule } from './build-active-rule.js';

// -------- Extract Rules from Quality Profiles --------

export async function extractRulesFromProfiles(client, profiles, usedLanguages) {
  const allActiveRules = [];
  const ruleMap = new Map();

  for (const profile of profiles) {
    if (usedLanguages.size > 0 && profile.language && !usedLanguages.has(profile.language.toLowerCase())) {
      logger.debug(`Skipping profile for unused language: ${profile.language}`);
      continue;
    }
    logger.info(`Extracting rules from profile: ${profile.name} (${profile.language})`);
    const rules = await client.getActiveRules(profile.key);
    logger.info(`  Found ${rules.length} active rules`);

    for (const rule of rules) {
      const ruleId = `${rule.repo || rule.repository}:${rule.key}`;
      if (ruleMap.has(ruleId)) continue;
      const activeRule = buildActiveRule(rule, profile);
      allActiveRules.push(activeRule);
      ruleMap.set(ruleId, activeRule);
    }
  }

  return allActiveRules;
}
