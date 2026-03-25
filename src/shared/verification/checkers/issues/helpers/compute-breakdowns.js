// -------- Compute Type/Severity Breakdowns --------

/**
 * Compute type and severity breakdown counts for a list of issues.
 * @param {Array} issues - Issue list
 * @returns {{ typeBreakdown: object, severityBreakdown: object }}
 */
export function computeBreakdowns(issues) {
  const typeBreakdown = {};
  const severityBreakdown = {};

  for (const issue of issues) {
    const type = issue.type || 'UNKNOWN';
    const severity = issue.severity || 'UNKNOWN';
    typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
    severityBreakdown[severity] = (severityBreakdown[severity] || 0) + 1;
  }

  return { typeBreakdown, severityBreakdown };
}
