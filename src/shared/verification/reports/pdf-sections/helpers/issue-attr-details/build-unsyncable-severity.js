// -------- Build Unsyncable Severity PDF Section --------

import { h, truncate, smallTable } from '../pdf-table-utils.js';

export function buildUnsyncableSeverity(c, nodes) {
  if (!c.issues?.unsyncable?.severityChangeDetails?.length) return;
  nodes.push({ text: `Unsyncable Issue Severity Changes (${c.issues.unsyncable.severityChanges})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('SQ Severity'), h('SC Severity')]];
  for (const m of c.issues.unsyncable.severityChangeDetails.slice(0, 50)) {
    rows.push([m.rule, truncate(m.file, 35), m.sqSeverity, m.scSeverity]);
  }
  if (c.issues.unsyncable.severityChanges > 50) rows.push([{ text: `... and ${c.issues.unsyncable.severityChanges - 50} more`, colSpan: 4, italics: true }, '', '', '']);
  nodes.push(smallTable(rows, [80, '*', 80, 80]));
}
