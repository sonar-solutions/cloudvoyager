// -------- Format Failed Assignments --------

export function formatFailedAssignments(results) {
  const failures = results.issueSyncStats.failedAssignments || [];
  if (failures.length === 0) return null;
  const lines = [
    '## Failed Issue Assignments\n',
    `> **${failures.length} issue(s)** could not be assigned because the SonarQube assignee login does not match a valid SonarCloud user. These issues need manual assignment in SonarCloud.\n`,
    '| Issue Key | SQ Assignee | Target Assignee | Error |',
    '|-----------|-------------|-----------------|-------|',
  ];
  for (const f of failures) {
    const target = f.sqAssignee && f.sqAssignee !== f.assignee ? f.assignee : '';
    lines.push(`| \`${f.issueKey}\` | ${f.sqAssignee || f.assignee} | ${target} | ${f.error} |`);
  }
  lines.push('');
  return lines.join('\n');
}
