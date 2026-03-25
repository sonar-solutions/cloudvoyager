import { buildActiveRule } from './build-active-rule.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Extract Rules From Profiles --------

/** Extract active rules from all relevant quality profiles. */
export async function extractRulesFromProfiles(client, profiles, usedLanguages) {
  const allActiveRules = [];
  const ruleMap = new Map();

  for (const profile of profiles) {
    if (!isProfileLanguageUsed(profile, usedLanguages)) {
      logger.debug(`Skipping profile for unused language: ${profile.language}`);
      continue;
    }
    logger.info(`Extracting rules from profile: ${profile.name} (${profile.language})`);
    const rules = await client.getActiveRules(profile.key);
    logger.info(`  Found ${rules.length} active rules`);
    addNewRules(rules, profile, ruleMap, allActiveRules);
  }

  return allActiveRules;
}

function isProfileLanguageUsed(profile, usedLanguages) {
  return usedLanguages.size === 0 || (profile.language && usedLanguages.has(profile.language.toLowerCase()));
}

function addNewRules(rules, profile, ruleMap, allActiveRules) {
  for (const rule of rules) {
    const ruleId = `${rule.repo || rule.repository}:${rule.key}`;
    if (ruleMap.has(ruleId)) continue;
    const activeRule = buildActiveRule(rule, profile);
    allActiveRules.push(activeRule);
    ruleMap.set(ruleId, activeRule);
  }
}
