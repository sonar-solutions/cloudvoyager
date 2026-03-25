import logger from '../../../../../shared/utils/logger.js';
import { mapSoftwareQuality, mapImpactSeverity } from '../../../sonarqube/extractors/rule-helpers.js';

// -------- Build Active Rules --------

/** Build active rules messages, skipping external repos and enriching impacts. */
export function buildActiveRules(inst) {
  logger.info('Building active rules messages...');
  const langToSCProfileKey = new Map();
  if (inst.sonarCloudProfiles?.length > 0) {
    inst.sonarCloudProfiles.forEach(p => { langToSCProfileKey.set(p.language.toLowerCase(), p.key); });
  }

  const activeRules = [];
  let skippedExternal = 0;

  inst.data.activeRules.forEach(rule => {
    if (inst.sonarCloudRepos?.size > 0 && !inst.sonarCloudRepos.has(rule.ruleRepository)) { skippedExternal++; return; }

    let ruleKey = rule.ruleKey;
    if (ruleKey?.includes(':')) ruleKey = ruleKey.split(':').pop();
    let qProfileKey = rule.qProfileKey;
    if (rule.language && langToSCProfileKey.has(rule.language.toLowerCase())) {
      qProfileKey = langToSCProfileKey.get(rule.language.toLowerCase());
    }

    const activeRule = { ruleRepository: rule.ruleRepository, ruleKey, severity: rule.severity, paramsByKey: rule.paramsByKey || {}, createdAt: rule.createdAt, updatedAt: rule.updatedAt, qProfileKey };

    if (rule.impacts?.length > 0) {
      activeRule.impacts = rule.impacts.map(i => ({ softwareQuality: i.softwareQuality, severity: i.severity }));
    } else if (inst.ruleEnrichmentMap.size > 0) {
      const enrichment = inst.ruleEnrichmentMap.get(`${rule.ruleRepository}:${ruleKey}`);
      if (enrichment?.impacts?.length > 0) {
        activeRule.impacts = enrichment.impacts.map(i => ({ softwareQuality: mapSoftwareQuality(i.softwareQuality), severity: mapImpactSeverity(i.severity) }));
      }
    }
    activeRules.push(activeRule);
  });

  if (skippedExternal > 0) logger.info(`Skipped ${skippedExternal} active rules from external repositories (handled via ad-hoc rules)`);
  logger.info(`Built ${activeRules.length} active rule messages`);
  return activeRules;
}
