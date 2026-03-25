import logger from '../../../../../shared/utils/logger.js';
import { isExternalIssue } from './is-external-issue.js';
import { resolveCleanCodeAttr } from './resolve-clean-code-attr.js';
import { resolveImpacts } from './resolve-impacts.js';
import { buildSingleExternalIssue } from './build-single-external-issue.js';
import { collectAdHocRule } from './collect-ad-hoc-rule.js';
import { logExternalIssueSummary } from './log-summary.js';

// -------- Main Logic --------

// Build ExternalIssue protobuf messages and collect AdHocRule definitions.
export function buildExternalIssues(builder) {
  const sonarCloudRepos = builder.sonarCloudRepos;
  if (!sonarCloudRepos || sonarCloudRepos.size === 0) {
    logger.debug('No SonarCloud repositories available — skipping external issue auto-detection');
    return { externalIssuesByComponent: new Map(), adHocRules: [] };
  }

  logger.info('Auto-detecting external issues (rule repos not in SonarCloud)...');
  const ruleEnrichmentMap = builder.ruleEnrichmentMap || new Map();
  const externalIssuesByComponent = new Map(), adHocRules = new Map();
  const detectedEngines = new Set();
  let skippedIssues = 0, enrichedCount = 0;

  for (const issue of builder.data.issues) {
    if (!isExternalIssue(issue, sonarCloudRepos)) continue;
    if (!builder.validComponentKeys?.has(issue.component) || !builder.componentRefMap.get(issue.component)) { skippedIssues++; continue; }

    const [engineId = 'unknown', ruleId = issue.rule] = issue.rule.split(':');
    detectedEngines.add(engineId);
    const fullRuleKey = `${engineId}:${ruleId}`;
    const enrichment = ruleEnrichmentMap.get(fullRuleKey);
    const { attr: cleanCodeAttr, enriched } = resolveCleanCodeAttr(issue, enrichment);
    if (enriched) enrichedCount++;
    const impacts = resolveImpacts(issue, enrichment);

    const { externalIssue, componentRef } = buildSingleExternalIssue(issue, engineId, ruleId, builder, cleanCodeAttr, impacts);
    if (!externalIssuesByComponent.has(componentRef)) externalIssuesByComponent.set(componentRef, []);
    externalIssuesByComponent.get(componentRef).push(externalIssue);
    collectAdHocRule(adHocRules, fullRuleKey, engineId, ruleId, issue, builder, cleanCodeAttr, impacts);
  }

  logExternalIssueSummary(externalIssuesByComponent, adHocRules, detectedEngines, skippedIssues, enrichedCount);
  return { externalIssuesByComponent, adHocRules: [...adHocRules.values()] };
}
