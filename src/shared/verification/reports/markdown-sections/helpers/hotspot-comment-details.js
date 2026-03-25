// -------- Hotspot Comment & Assignment Details --------

/**
 * Format hotspot comment mismatches.
 */
export function formatHotspotCommentMismatches(c, lines) {
  if (!c.hotspots?.commentMismatches?.length) return;
  lines.push(`<details><summary>Hotspot Comment Mismatches (${c.hotspots.commentMismatches.length})</summary>\n`);
  lines.push(`| Rule | File | SQ Comments | SC Migrated Comments |`);
  lines.push(`|------|------|-------------|---------------------|`);
  for (const m of c.hotspots.commentMismatches.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.sqCommentCount} | ${m.scMigratedCommentCount} |`);
  }
  if (c.hotspots.commentMismatches.length > 200) lines.push(`\n*... and ${c.hotspots.commentMismatches.length - 200} more*`);
  lines.push('\n</details>\n');
}

/**
 * Format unsyncable hotspot assignment diffs.
 */
export function formatUnsyncableAssignments(c, lines) {
  if (!c.hotspots?.unsyncable?.assignmentDetails?.length) return;
  lines.push(`<details><summary>Unsyncable Hotspot Assignment Diffs (${c.hotspots.unsyncable.assignments})</summary>\n`);
  lines.push(`| Rule | File | SQ Assignee | SC Assignee |`);
  lines.push(`|------|------|-------------|-------------|`);
  for (const m of c.hotspots.unsyncable.assignmentDetails.slice(0, 100)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.sqAssignee || 'none'} | ${m.scAssignee || 'none'} |`);
  }
  if (c.hotspots.unsyncable.assignments > 100) lines.push(`\n*... and ${c.hotspots.unsyncable.assignments - 100} more*`);
  lines.push('\n</details>\n');
}
