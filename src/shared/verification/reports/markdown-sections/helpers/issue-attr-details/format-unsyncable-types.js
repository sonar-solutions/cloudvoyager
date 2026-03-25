// -------- Format Unsyncable Type Changes --------

export function formatUnsyncableTypeChanges(c, lines) {
  if (!c.issues?.unsyncable?.typeChangeDetails?.length) return;
  lines.push(`<details><summary>Unsyncable Issue Type Changes (${c.issues.unsyncable.typeChanges})</summary>\n`);
  lines.push(`| Rule | File | SQ Type | SC Type |`);
  lines.push(`|------|------|---------|---------|`);
  for (const m of c.issues.unsyncable.typeChangeDetails.slice(0, 100)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.sqType} | ${m.scType} |`);
  }
  if (c.issues.unsyncable.typeChanges > 100) lines.push(`\n*... and ${c.issues.unsyncable.typeChanges - 100} more*`);
  lines.push('\n</details>\n');
}
