import { mapSeverity, extractImpacts } from '../../rule-helpers.js';

// -------- Build Active Rule --------

export function buildActiveRule(rule, profile) {
  const paramsMap = {};
  if (rule.params && Array.isArray(rule.params)) {
    rule.params.forEach(param => { paramsMap[param.key] = param.defaultValue || param.value || ''; });
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
    impacts: extractImpacts(rule),
  };
}
