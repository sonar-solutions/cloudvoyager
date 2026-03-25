// -------- Build Unsyncable Types PDF Section --------

import { h, truncate, smallTable } from '../pdf-table-utils.js';

export function buildUnsyncableTypes(c, nodes) {
  if (!c.issues?.unsyncable?.typeChangeDetails?.length) return;
  nodes.push({ text: `Unsyncable Issue Type Changes (${c.issues.unsyncable.typeChanges})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('SQ Type'), h('SC Type')]];
  for (const m of c.issues.unsyncable.typeChangeDetails.slice(0, 50)) {
    rows.push([m.rule, truncate(m.file, 35), m.sqType, m.scType]);
  }
  if (c.issues.unsyncable.typeChanges > 50) rows.push([{ text: `... and ${c.issues.unsyncable.typeChanges - 50} more`, colSpan: 4, italics: true }, '', '', '']);
  nodes.push(smallTable(rows, [80, '*', 80, 80]));
}
