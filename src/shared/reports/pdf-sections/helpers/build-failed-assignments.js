// -------- Build Failed Assignments --------

export function buildFailedAssignments(results) {
  const failures = results.issueSyncStats.failedAssignments || [];
  if (failures.length === 0) return [];
  const body = [
    [{ text: 'Issue Key', style: 'tableHeader' }, { text: 'SQ Assignee', style: 'tableHeader' }, { text: 'Target Assignee', style: 'tableHeader' }, { text: 'Error', style: 'tableHeader' }],
  ];
  for (const f of failures) {
    const target = f.sqAssignee && f.sqAssignee !== f.assignee ? f.assignee : '';
    body.push([
      { text: f.issueKey, style: 'tableCell' },
      { text: f.sqAssignee || f.assignee, style: 'tableCell' },
      { text: target, style: 'tableCell' },
      { text: f.error, style: 'tableCell', fontSize: 8 },
    ]);
  }
  return [
    { text: 'Failed Issue Assignments', style: 'heading' },
    { text: `${failures.length} issue(s) could not be assigned because the SonarQube assignee login does not match a valid SonarCloud user. Consider using user-mappings.csv to map SQ logins to SC logins.`, style: 'small', margin: [0, 0, 0, 5] },
    { table: { headerRows: 1, widths: ['*', 90, 90, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
