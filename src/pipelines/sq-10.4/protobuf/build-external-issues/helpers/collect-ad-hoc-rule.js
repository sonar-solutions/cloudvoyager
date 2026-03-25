import { mapIssueType } from './enum-mappers.js';

// -------- Main Logic --------

// Collect a unique ad-hoc rule definition from an external issue.
export function collectAdHocRule(adHocRules, fullRuleKey, engineId, ruleId, issue, builder, cleanCodeAttr, impacts) {
  if (adHocRules.has(fullRuleKey)) return;
  adHocRules.set(fullRuleKey, {
    engineId, ruleId, name: ruleId, description: '',
    severity: builder.mapSeverity(issue.severity), type: mapIssueType(issue.type),
    cleanCodeAttribute: cleanCodeAttr, defaultImpacts: impacts,
  });
}
