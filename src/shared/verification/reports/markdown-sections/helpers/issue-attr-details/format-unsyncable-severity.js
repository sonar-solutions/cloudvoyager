// -------- Format Unsyncable Severity Changes --------

export function formatUnsyncableSeverityChanges(c, lines) {
  if (!c.issues?.unsyncable?.severityChangeDetails?.length) return;
  lines.push(`<details><summary>Unsyncable Issue Severity Changes (${c.issues.unsyncable.severityChanges})</summary>\n`);
  lines.push(`| Rule | File | SQ Severity | SC Severity |`);
  lines.push(`|------|------|-------------|-------------|`);
  for (const m of c.issues.unsyncable.severityChangeDetails.slice(0, 100)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.sqSeverity} | ${m.scSeverity} |`);
  }
  if (c.issues.unsyncable.severityChanges > 100) lines.push(`\n*... and ${c.issues.unsyncable.severityChanges - 100} more*`);
  lines.push('\n</details>\n');
}
