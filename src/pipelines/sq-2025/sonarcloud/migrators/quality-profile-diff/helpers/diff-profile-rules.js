import logger from '../../../../../../shared/utils/logger.js';

// -------- Diff Profile Rules --------

/** Format a rule for the diff report. */
function formatRule(key, rule) {
  return { key, name: rule.name || '', type: rule.type || '', severity: rule.severity || '' };
}

/** Compare active rules between a SQ profile and its SC counterpart. */
export async function diffProfileRules(sqProfile, scProfile, sqClient, scClient) {
  logger.debug(`Comparing rules: SQ "${sqProfile.name}" vs SC "${scProfile.name}" (${sqProfile.language})`);

  const [sqRules, scRules] = await Promise.all([sqClient.getActiveRules(sqProfile.key), scClient.getActiveRules(scProfile.key)]);

  const sqRuleMap = new Map();
  for (const rule of sqRules) sqRuleMap.set(rule.key || `${rule.repo}:${rule.params?.[0]?.key || rule.name}`, rule);

  const scRuleMap = new Map();
  for (const rule of scRules) scRuleMap.set(rule.key || `${rule.repo}:${rule.name}`, rule);

  const missingRules = [];
  for (const [key, rule] of sqRuleMap) { if (!scRuleMap.has(key)) missingRules.push(formatRule(key, rule)); }

  const addedRules = [];
  for (const [key, rule] of scRuleMap) { if (!sqRuleMap.has(key)) addedRules.push(formatRule(key, rule)); }

  if (missingRules.length > 0) logger.warn(`  ${sqProfile.language}: ${missingRules.length} rules missing from SonarCloud`);
  if (addedRules.length > 0) logger.info(`  ${sqProfile.language}: ${addedRules.length} rules added in SonarCloud`);
  if (missingRules.length === 0 && addedRules.length === 0) logger.info(`  ${sqProfile.language}: profiles match perfectly (${sqRules.length} rules)`);

  return {
    sonarqubeProfile: sqProfile.name, sonarcloudProfile: scProfile.name,
    sonarqubeRuleCount: sqRules.length, sonarcloudRuleCount: scRules.length,
    missingRules, addedRules,
  };
}
