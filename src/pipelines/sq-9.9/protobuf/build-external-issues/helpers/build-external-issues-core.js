import logger from '../../../../../shared/utils/logger.js';
import { mapIssueType } from './enum-mappers.js';
import { isExternalIssue } from './is-external-issue.js';
import { buildSingleExternalIssue } from './build-single-external-issue.js';
import { logExternalIssueStats } from './log-external-issue-stats.js';

// -------- Build All External Issues from Builder Data --------

export function buildExternalIssues(builder) {
  const { sonarCloudRepos } = builder;
  if (!sonarCloudRepos || sonarCloudRepos.size === 0) {
    logger.warn('No SonarCloud repositories available — using fallback built-in repo list');
  }
  logger.info('Auto-detecting external issues (rule repos not in SonarCloud)...');
  const ruleEnrichmentMap = builder.ruleEnrichmentMap || new Map();
  const byComponent = new Map();
  const adHocRules = new Map();
  const engines = new Set();
  let skipped = 0, enriched = 0;

  builder.data.issues.forEach(issue => {
    if (!isExternalIssue(issue, sonarCloudRepos)) return;
    if (!builder.validComponentKeys?.has(issue.component)) { skipped++; return; }
    const componentRef = builder.componentRefMap.get(issue.component);
    if (!componentRef) { skipped++; return; }
    const [engineId = 'unknown', ruleId = issue.rule] = issue.rule.split(':');
    engines.add(engineId);
    const fullRuleKey = `${engineId}:${ruleId}`;
    const result = buildSingleExternalIssue(issue, engineId, ruleId, ruleEnrichmentMap.get(fullRuleKey), builder);
    if (result.enriched) enriched++;
    if (!byComponent.has(componentRef)) byComponent.set(componentRef, []);
    byComponent.get(componentRef).push(result.externalIssue);
    if (!adHocRules.has(fullRuleKey)) {
      adHocRules.set(fullRuleKey, {
        engineId, ruleId, name: ruleId, description: '',
        severity: builder.mapSeverity(issue.severity), type: mapIssueType(issue.type),
        cleanCodeAttribute: result.cleanCodeAttr, defaultImpacts: result.impacts,
      });
    }
  });
  logExternalIssueStats(byComponent, adHocRules, engines, skipped, enriched);
  return { externalIssuesByComponent: byComponent, adHocRules: [...adHocRules.values()] };
}
