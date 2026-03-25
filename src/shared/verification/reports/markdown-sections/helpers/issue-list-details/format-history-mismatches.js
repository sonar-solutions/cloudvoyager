// -------- Format History Mismatches --------

export function formatHistoryMismatches(c, lines) {
  if (!c.issues?.statusHistoryMismatches?.length) return;
  lines.push(`<details><summary>Issue Status History Mismatches (${c.issues.statusHistoryMismatches.length})</summary>\n`);
  lines.push(`| Rule | File | Line | SQ Transitions | SC Transitions | Missing |`);
  lines.push(`|------|------|------|----------------|----------------|---------|`);
  for (const m of c.issues.statusHistoryMismatches.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.line} | ${m.sqTransitions.join(' → ')} | ${m.scTransitions.join(' → ') || 'none'} | ${m.missingTransitions.join(', ')} |`);
  }
  if (c.issues.statusHistoryMismatches.length > 200) lines.push(`\n*... and ${c.issues.statusHistoryMismatches.length - 200} more*`);
  lines.push('\n</details>\n');
}
