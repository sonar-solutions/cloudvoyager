// -------- Issue Attribute Detail Sections --------

export { formatUnsyncableTypeChanges } from './issue-attr-details/format-unsyncable-types.js';
export { formatUnsyncableSeverityChanges } from './issue-attr-details/format-unsyncable-severity.js';

export function formatAssignmentMismatches(c, lines) {
  if (!c.issues?.assignmentMismatches?.length) return;
  lines.push(`<details><summary>Issue Assignment Mismatches (${c.issues.assignmentMismatches.length})</summary>\n`);
  lines.push(`| Rule | File | SQ Assignee | SC Assignee |`);
  lines.push(`|------|------|-------------|-------------|`);
  for (const m of c.issues.assignmentMismatches.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.sqAssignee || 'none'} | ${m.scAssignee || 'none'} |`);
  }
  if (c.issues.assignmentMismatches.length > 200) lines.push(`\n*... and ${c.issues.assignmentMismatches.length - 200} more*`);
  lines.push('\n</details>\n');
}

export function formatCommentMismatches(c, lines) {
  if (!c.issues?.commentMismatches?.length) return;
  lines.push(`<details><summary>Issue Comment Mismatches (${c.issues.commentMismatches.length})</summary>\n`);
  lines.push(`| Rule | File | SQ Comments | SC Migrated Comments |`);
  lines.push(`|------|------|-------------|---------------------|`);
  for (const m of c.issues.commentMismatches.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.sqCommentCount} | ${m.scMigratedCommentCount} |`);
  }
  if (c.issues.commentMismatches.length > 200) lines.push(`\n*... and ${c.issues.commentMismatches.length - 200} more*`);
  lines.push('\n</details>\n');
}

export function formatTagMismatches(c, lines) {
  if (!c.issues?.tagMismatches?.length) return;
  lines.push(`<details><summary>Issue Tag Mismatches (${c.issues.tagMismatches.length})</summary>\n`);
  lines.push(`| Rule | File | SQ Tags | SC Tags |`);
  lines.push(`|------|------|---------|---------|`);
  for (const m of c.issues.tagMismatches.slice(0, 200)) {
    lines.push(`| ${m.rule} | ${m.file} | ${m.sqTags.join(', ')} | ${m.scTags.join(', ')} |`);
  }
  if (c.issues.tagMismatches.length > 200) lines.push(`\n*... and ${c.issues.tagMismatches.length - 200} more*`);
  lines.push('\n</details>\n');
}
