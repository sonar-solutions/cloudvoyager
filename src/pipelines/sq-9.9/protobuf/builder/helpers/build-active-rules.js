import logger from '../../../../../shared/utils/logger.js';
import { mapSoftwareQuality, mapImpactSeverity } from '../../../sonarqube/extractors/rule-helpers.js';

// -------- Build Active Rule Messages --------

export function buildActiveRules(ctx) {
  logger.info('Building active rules messages...');
  const langToSCProfileKey = new Map();
  if (ctx.sonarCloudProfiles?.length > 0) {
    ctx.sonarCloudProfiles.forEach(p => { langToSCProfileKey.set(p.language.toLowerCase(), p.key); });
  }

  const { sonarCloudRepos, ruleEnrichmentMap } = ctx;
  const activeRules = [];
  let skippedExternal = 0;

  ctx.data.activeRules.forEach(rule => {
    if (sonarCloudRepos?.size > 0 && !sonarCloudRepos.has(rule.ruleRepository)) { skippedExternal++; return; }
    let ruleKey = rule.ruleKey;
    if (ruleKey?.includes(':')) ruleKey = ruleKey.split(':').pop();
    let qProfileKey = rule.qProfileKey;
    if (rule.language && langToSCProfileKey.has(rule.language.toLowerCase())) {
      qProfileKey = langToSCProfileKey.get(rule.language.toLowerCase());
    }
    const activeRule = {
      ruleRepository: rule.ruleRepository, ruleKey, severity: rule.severity,
      paramsByKey: rule.paramsByKey || {}, createdAt: rule.createdAt, updatedAt: rule.updatedAt, qProfileKey,
    };
    enrichRuleImpacts(activeRule, rule, ruleEnrichmentMap);
    activeRules.push(activeRule);
  });

  if (skippedExternal > 0) logger.info(`Skipped ${skippedExternal} active rules from external repositories`);
  logger.info(`Built ${activeRules.length} active rule messages`);
  return activeRules;
}

function enrichRuleImpacts(activeRule, rule, ruleEnrichmentMap) {
  if (rule.impacts?.length > 0) {
    activeRule.impacts = rule.impacts.map(i => ({ softwareQuality: i.softwareQuality, severity: i.severity }));
  } else if (ruleEnrichmentMap.size > 0) {
    const key = `${rule.ruleRepository}:${activeRule.ruleKey}`;
    const enrichment = ruleEnrichmentMap.get(key);
    if (enrichment?.impacts?.length > 0) {
      activeRule.impacts = enrichment.impacts.map(i => ({ softwareQuality: mapSoftwareQuality(i.softwareQuality), severity: mapImpactSeverity(i.severity) }));
    }
  }
}
