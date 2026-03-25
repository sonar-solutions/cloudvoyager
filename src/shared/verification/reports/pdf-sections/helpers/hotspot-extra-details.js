// -------- PDF Hotspot Comment & Assignment Details --------

import { h, truncate, smallTable } from './pdf-table-utils.js';

export function buildCommentMismatches(c, nodes) {
  if (!c.hotspots?.commentMismatches?.length) return;
  nodes.push({ text: `Hotspot Comment Mismatches (${c.hotspots.commentMismatches.length})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('SQ Comments'), h('SC Migrated')]];
  for (const m of c.hotspots.commentMismatches.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 35), String(m.sqCommentCount), String(m.scMigratedCommentCount)]);
  }
  if (c.hotspots.commentMismatches.length > 100) rows.push([{ text: `... and more`, colSpan: 4, italics: true }, '', '', '']);
  nodes.push(smallTable(rows, [80, '*', 80, 80]));
}

export function buildUnsyncableAssignments(c, nodes) {
  if (!c.hotspots?.unsyncable?.assignmentDetails?.length) return;
  nodes.push({ text: `Unsyncable Hotspot Assignment Diffs (${c.hotspots.unsyncable.assignments})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('SQ Assignee'), h('SC Assignee')]];
  for (const m of c.hotspots.unsyncable.assignmentDetails.slice(0, 50)) {
    rows.push([m.rule, truncate(m.file, 35), m.sqAssignee || 'none', m.scAssignee || 'none']);
  }
  if (c.hotspots.unsyncable.assignments > 50) rows.push([{ text: `... and more`, colSpan: 4, italics: true }, '', '', '']);
  nodes.push(smallTable(rows, [80, '*', 100, 100]));
}
