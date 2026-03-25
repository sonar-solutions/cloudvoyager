// -------- PDF Issue Attribute Detail Sections --------

import { h, truncate, smallTable } from './pdf-table-utils.js';
export { buildUnsyncableTypes } from './issue-attr-details/build-unsyncable-types.js';
export { buildUnsyncableSeverity } from './issue-attr-details/build-unsyncable-severity.js';

export function buildAssignmentMismatches(c, nodes) {
  if (!c.issues?.assignmentMismatches?.length) return;
  nodes.push({ text: `Issue Assignment Mismatches (${c.issues.assignmentMismatches.length})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('SQ Assignee'), h('SC Assignee')]];
  for (const m of c.issues.assignmentMismatches.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 35), m.sqAssignee || 'none', m.scAssignee || 'none']);
  }
  if (c.issues.assignmentMismatches.length > 100) rows.push([{ text: `... and ${c.issues.assignmentMismatches.length - 100} more`, colSpan: 4, italics: true }, '', '', '']);
  nodes.push(smallTable(rows, [80, '*', 100, 100]));
}

export function buildCommentMismatches(c, nodes) {
  if (!c.issues?.commentMismatches?.length) return;
  nodes.push({ text: `Issue Comment Mismatches (${c.issues.commentMismatches.length})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('SQ Comments'), h('SC Migrated')]];
  for (const m of c.issues.commentMismatches.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 35), String(m.sqCommentCount), String(m.scMigratedCommentCount)]);
  }
  if (c.issues.commentMismatches.length > 100) rows.push([{ text: `... and ${c.issues.commentMismatches.length - 100} more`, colSpan: 4, italics: true }, '', '', '']);
  nodes.push(smallTable(rows, [80, '*', 80, 80]));
}

export function buildTagMismatches(c, nodes) {
  if (!c.issues?.tagMismatches?.length) return;
  nodes.push({ text: `Issue Tag Mismatches (${c.issues.tagMismatches.length})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('SQ Tags'), h('SC Tags')]];
  for (const m of c.issues.tagMismatches.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 30), m.sqTags.join(', '), m.scTags.join(', ')]);
  }
  if (c.issues.tagMismatches.length > 100) rows.push([{ text: `... and ${c.issues.tagMismatches.length - 100} more`, colSpan: 4, italics: true }, '', '', '']);
  nodes.push(smallTable(rows, [80, 100, '*', '*']));
}
