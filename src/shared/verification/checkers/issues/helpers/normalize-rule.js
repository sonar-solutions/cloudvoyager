// -------- Normalize Rule Key --------

/**
 * Normalize a rule key for matching.
 * SC external issues use "external_<engineId>:<ruleId>" while SQ uses "<engineId>:<ruleId>".
 * Strip the "external_" prefix so both sides produce the same key.
 */
export function normalizeRule(rule) {
  if (!rule) return rule;
  return rule.startsWith('external_') ? rule.slice('external_'.length) : rule;
}
