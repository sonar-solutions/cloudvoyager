import { mapSoftwareQuality, mapImpactSeverity } from '../../../sonarqube/extractors/rule-helpers.js';

// -------- Enrich Active Rule Impacts --------

export function enrichActiveRuleImpacts(ar, rule, ruleKey, enrichmentMap) {
  if (rule.impacts?.length > 0) {
    ar.impacts = rule.impacts.map(i => ({ softwareQuality: i.softwareQuality, severity: i.severity }));
  } else if (enrichmentMap.size > 0) {
    const key = `${rule.ruleRepository}:${ruleKey}`;
    const enrichment = enrichmentMap.get(key);
    if (enrichment?.impacts?.length > 0) {
      ar.impacts = enrichment.impacts.map(i => ({ softwareQuality: mapSoftwareQuality(i.softwareQuality), severity: mapImpactSeverity(i.severity) }));
    }
  }
}
