import logger from '../../../../../../shared/utils/logger.js';

// -------- Diff Profile Rules --------

export async function diffProfileRules(sqProfile, scProfile, sqClient, scClient) {
  logger.debug(`Comparing rules: SQ "${sqProfile.name}" vs SC "${scProfile.name}" (${sqProfile.language})`);

  const [sqRules, scRules] = await Promise.all([
    sqClient.getActiveRules(sqProfile.key),
    scClient.getActiveRules(scProfile.key),
  ]);

  const sqRuleMap = new Map();
  for (const rule of sqRules) {
    sqRuleMap.set(rule.key || `${rule.repo}:${rule.params?.[0]?.key || rule.name}`, rule);
  }

  const scRuleMap = new Map();
  for (const rule of scRules) {
    scRuleMap.set(rule.key || `${rule.repo}:${rule.name}`, rule);
  }

  const missingRules = [...sqRuleMap].filter(([k]) => !scRuleMap.has(k)).map(([k, r]) => formatRule(k, r));
  const addedRules = [...scRuleMap].filter(([k]) => !sqRuleMap.has(k)).map(([k, r]) => formatRule(k, r));

  if (missingRules.length > 0) logger.warn(`  ${sqProfile.language}: ${missingRules.length} rules missing from SonarCloud`);
  if (addedRules.length > 0) logger.info(`  ${sqProfile.language}: ${addedRules.length} rules added in SonarCloud`);
  if (missingRules.length === 0 && addedRules.length === 0) logger.info(`  ${sqProfile.language}: profiles match perfectly (${sqRules.length} rules)`);

  return {
    sonarqubeProfile: sqProfile.name, sonarcloudProfile: scProfile.name,
    sonarqubeRuleCount: sqRules.length, sonarcloudRuleCount: scRules.length,
    missingRules, addedRules,
  };
}

function formatRule(key, rule) {
  return { key, name: rule.name || '', type: rule.type || '', severity: rule.severity || '' };
}
