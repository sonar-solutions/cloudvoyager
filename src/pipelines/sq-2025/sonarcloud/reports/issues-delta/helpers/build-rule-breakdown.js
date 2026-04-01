// -------- Build Rule Breakdown --------

/**
 * Group disappeared/appeared issues by rule key.
 * Returns { [ruleKey]: { disappeared: number, appeared: number } }
 */
export function buildRuleBreakdown(onlyInSQ, onlyInSC) {
  const byRule = {};

  for (const issue of onlyInSQ) {
    if (!byRule[issue.rule]) byRule[issue.rule] = { disappeared: 0, appeared: 0 };
    byRule[issue.rule].disappeared++;
  }

  for (const issue of onlyInSC) {
    if (!byRule[issue.rule]) byRule[issue.rule] = { disappeared: 0, appeared: 0 };
    byRule[issue.rule].appeared++;
  }

  return byRule;
}
