import { mapIssueType } from './enum-mappers.js';
import { isExternalIssue } from './is-external-issue.js';
import { buildExternalIssueMsg } from './build-external-issue-msg.js';
import { buildIssueFlows } from './build-issue-flows.js';
import { stripExternalPrefix } from '../../../../../shared/utils/strip-external-prefix/index.js';

// -------- Process External Issues --------

/**
 * Iterate all issues, filter to external, build messages and ad-hoc rules.
 */
export function processExternalIssues(builder, sonarCloudRepos) {
  const ruleEnrichmentMap = builder.ruleEnrichmentMap || new Map();
  const externalIssuesByComponent = new Map();
  const adHocRules = new Map();
  const detectedEngines = new Set();
  let skippedIssues = 0;
  let enrichedCount = 0;

  builder.data.issues.forEach(issue => {
    if (!isExternalIssue(issue, sonarCloudRepos)) return;

    if (!builder.validComponentKeys?.has(issue.component)) { skippedIssues++; return; }
    const componentRef = builder.componentRefMap.get(issue.component);
    if (!componentRef) { skippedIssues++; return; }

    const [rawEngine = 'unknown', ruleId = issue.rule] = issue.rule.split(':');
    const engineId = stripExternalPrefix(rawEngine);
    detectedEngines.add(engineId);

    const fullRuleKey = `${engineId}:${ruleId}`;
    const enrichment = ruleEnrichmentMap.get(fullRuleKey);
    const { externalIssue, cleanCodeAttr, impacts, wasEnriched } = buildExternalIssueMsg(issue, engineId, ruleId, enrichment, builder);
    if (wasEnriched) enrichedCount++;

    buildIssueFlows(externalIssue, issue, builder, componentRef);

    if (!externalIssuesByComponent.has(componentRef)) externalIssuesByComponent.set(componentRef, []);
    externalIssuesByComponent.get(componentRef).push(externalIssue);

    if (!adHocRules.has(fullRuleKey)) {
      adHocRules.set(fullRuleKey, {
        engineId, ruleId, name: ruleId, description: '',
        severity: builder.mapSeverity(issue.severity), type: mapIssueType(issue.type),
        cleanCodeAttribute: cleanCodeAttr, defaultImpacts: impacts,
      });
    }
  });

  return { externalIssuesByComponent, adHocRules, detectedEngines, skippedIssues, enrichedCount };
}
