// -------- Format Failed Assignments --------

export function formatFailedAssignments(lines, results, subsep) {
  const failures = results.issueSyncStats.failedAssignments || [];
  if (failures.length === 0) return;
  lines.push(
    'FAILED ISSUE ASSIGNMENTS', subsep,
    `  ${failures.length} issue(s) could not be assigned because the SonarQube assignee`,
    '  login does not match a valid SonarCloud user.', '',
  );
  for (const f of failures) {
    const mappingNote = f.sqAssignee && f.sqAssignee !== f.assignee
      ? ` (SQ: "${f.sqAssignee}" -> SC: "${f.assignee}")`
      : `"${f.assignee}"`;
    lines.push(`  [WARN] ${f.issueKey}: could not assign to ${mappingNote} -- ${f.error}`);
  }
  lines.push('');
}
