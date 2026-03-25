import logger from '../../../../../shared/utils/logger.js';
import { enrichActiveRuleImpacts } from './enrich-rule-impacts.js';

// -------- Active Rules Builder --------

export function buildActiveRules(ctx) {
  logger.info('Building active rules messages...');
  const langToSCProfileKey = new Map();
  if (ctx.sonarCloudProfiles?.length > 0) {
    ctx.sonarCloudProfiles.forEach(p => { langToSCProfileKey.set(p.language.toLowerCase(), p.key); });
  }
  const scRepos = ctx.sonarCloudRepos;
  const activeRules = [];
  let skippedExternal = 0;
  ctx.data.activeRules.forEach(rule => {
    if (scRepos && scRepos.size > 0 && !scRepos.has(rule.ruleRepository)) { skippedExternal++; return; }
    activeRules.push(buildSingleActiveRule(rule, langToSCProfileKey, ctx.ruleEnrichmentMap));
  });
  if (skippedExternal > 0) {
    logger.info(`Skipped ${skippedExternal} active rules from external repositories (handled via ad-hoc rules)`);
  }
  logger.info(`Built ${activeRules.length} active rule messages`);
  return activeRules;
}

function buildSingleActiveRule(rule, langToSCProfileKey, enrichmentMap) {
  let ruleKey = rule.ruleKey;
  if (ruleKey?.includes(':')) ruleKey = ruleKey.split(':').pop();
  let qProfileKey = rule.qProfileKey;
  if (rule.language && langToSCProfileKey.has(rule.language.toLowerCase())) {
    qProfileKey = langToSCProfileKey.get(rule.language.toLowerCase());
  }
  const ar = {
    ruleRepository: rule.ruleRepository, ruleKey, severity: rule.severity,
    paramsByKey: rule.paramsByKey || {}, createdAt: rule.createdAt,
    updatedAt: rule.updatedAt, qProfileKey,
  };
  enrichActiveRuleImpacts(ar, rule, ruleKey, enrichmentMap);
  return ar;
}
