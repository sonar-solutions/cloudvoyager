// -------- Collect Ad-Hoc Rule --------

/** Add a unique ad-hoc rule entry to the rules map. */
export function collectAdHocRule(adHocRules, fullRuleKey, extIssue, cleanCodeAttr, impacts) {
  if (adHocRules.has(fullRuleKey)) return;

  adHocRules.set(fullRuleKey, {
    engineId: extIssue.engineId,
    ruleId: extIssue.ruleId,
    name: extIssue.ruleId,
    description: '',
    severity: extIssue.severity,
    type: extIssue.type,
    cleanCodeAttribute: cleanCodeAttr,
    defaultImpacts: impacts,
  });
}
