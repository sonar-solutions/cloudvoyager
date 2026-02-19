import logger from '../../utils/logger.js';
import { mapSeverity, extractImpacts } from './rule-helpers.js';

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

function detectUsedLanguages(components) {
  const usedLanguages = new Set();
  components.forEach(comp => {
    if (comp.language) usedLanguages.add(comp.language.toLowerCase());
  });
  if (usedLanguages.has('js') || usedLanguages.has('javascript')) {
    usedLanguages.add('js');
    usedLanguages.add('javascript');
    usedLanguages.add('ts');
    usedLanguages.add('web');
  }
  return usedLanguages;
}

function isProfileLanguageUsed(profile, usedLanguages) {
  return usedLanguages.size === 0 || usedLanguages.has(profile.language.toLowerCase());
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

async function extractRulesFromProfiles(client, profiles, usedLanguages) {
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

function buildActiveRule(rule, profile) {
  const paramsMap = {};
  if (rule.params && Array.isArray(rule.params)) {
    rule.params.forEach(param => {
      paramsMap[param.key] = param.defaultValue || param.value || '';
    });
  }
  return {
    ruleRepository: rule.repo || rule.repository || 'unknown',
    ruleKey: rule.key,
    severity: mapSeverity(rule.severity),
    paramsByKey: paramsMap,
    createdAt: rule.createdAt ? new Date(rule.createdAt).getTime() : Date.now(),
    updatedAt: rule.updatedAt ? new Date(rule.updatedAt).getTime() : Date.now(),
    qProfileKey: profile.key,
    language: profile.language,
    impacts: extractImpacts(rule)
  };
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
