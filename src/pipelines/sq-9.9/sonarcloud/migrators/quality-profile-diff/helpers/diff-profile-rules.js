import logger from '../../../../../../shared/utils/logger.js';
import { formatRule } from './format-rule.js';
import { logDiffResults } from './log-diff-results.js';

// -------- Compare Active Rules Between SQ and SC Profiles --------

export async function diffProfileRules(sqProfile, scProfile, sqClient, scClient) {
  logger.debug(`Comparing rules: SQ "${sqProfile.name}" vs SC "${scProfile.name}" (${sqProfile.language})`);

  const [sqRules, scRules] = await Promise.all([
    sqClient.getActiveRules(sqProfile.key),
    scClient.getActiveRules(scProfile.key)
  ]);

  const sqRuleMap = buildRuleMap(sqRules);
  const scRuleMap = buildRuleMap(scRules);
  const missingRules = findMissingRules(sqRuleMap, scRuleMap);
  const addedRules = findMissingRules(scRuleMap, sqRuleMap);

  logDiffResults(sqProfile.language, missingRules, addedRules, sqRules.length);

  return {
    sonarqubeProfile: sqProfile.name, sonarcloudProfile: scProfile.name,
    sonarqubeRuleCount: sqRules.length, sonarcloudRuleCount: scRules.length,
    missingRules, addedRules
  };
}

function buildRuleMap(rules) {
  const map = new Map();
  for (const rule of rules) {
    const key = rule.key || `${rule.repo}:${rule.params?.[0]?.key || rule.name}`;
    map.set(key, rule);
  }
  return map;
}

function findMissingRules(sourceMap, targetMap) {
  const missing = [];
  for (const [key, rule] of sourceMap) {
    if (!targetMap.has(key)) missing.push(formatRule(key, rule));
  }
  return missing;
}
