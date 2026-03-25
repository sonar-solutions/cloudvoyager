// -------- Format a Rule for the Diff Report --------

export function formatRule(key, rule) {
  return {
    key,
    name: rule.name || '',
    type: rule.type || '',
    severity: rule.severity || ''
  };
}
