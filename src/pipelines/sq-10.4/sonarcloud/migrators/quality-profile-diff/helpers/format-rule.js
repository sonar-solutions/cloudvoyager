// -------- Main Logic --------

// Format a rule for the diff report.
export function formatRule(key, rule) {
  return { key, name: rule.name || '', type: rule.type || '', severity: rule.severity || '' };
}
