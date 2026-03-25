// -------- PDF Issue List Detail Sections --------

import { h, truncate, smallTable } from './pdf-table-utils.js';

export function buildUnmatchedSq(c, nodes) {
  if (!c.issues?.unmatchedSqIssues?.length) return;
  nodes.push({ text: `Unmatched SQ Issues — in SonarQube but NOT in SonarCloud (${c.issues.unmatched})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('Line'), h('Type'), h('Severity'), h('Message')]];
  for (const m of c.issues.unmatchedSqIssues.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 30), String(m.line), m.type, m.severity, truncate(m.message, 40)]);
  }
  if (c.issues.unmatched > 100) rows.push([{ text: `... and ${c.issues.unmatched - 100} more`, colSpan: 6, italics: true }, '', '', '', '', '']);
  nodes.push(smallTable(rows, [70, 100, 30, 60, 55, '*']));
}

export function buildScOnly(c, nodes) {
  if (!c.issues?.scOnlyIssues?.length) return;
  nodes.push({ text: `SC-Only Issues — in SonarCloud but NOT in SonarQube (${c.issues.scOnlyIssues.length})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('Line'), h('Type'), h('Severity'), h('Message')]];
  for (const m of c.issues.scOnlyIssues.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 30), String(m.line), m.type, m.severity, truncate(m.message, 40)]);
  }
  if (c.issues.scOnlyIssues.length > 100) rows.push([{ text: `... and ${c.issues.scOnlyIssues.length - 100} more`, colSpan: 6, italics: true }, '', '', '', '', '']);
  nodes.push(smallTable(rows, [70, 100, 30, 60, 55, '*']));
}

export function buildStatusMismatches(c, nodes) {
  if (!c.issues?.statusMismatches?.length) return;
  nodes.push({ text: `Issue Status Mismatches (${c.issues.statusMismatches.length})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('Line'), h('SQ Status'), h('SC Status')]];
  for (const m of c.issues.statusMismatches.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 30), String(m.line), `${m.sqStatus}${m.sqResolution ? '/' + m.sqResolution : ''}`, `${m.scStatus}${m.scResolution ? '/' + m.scResolution : ''}`]);
  }
  if (c.issues.statusMismatches.length > 100) rows.push([{ text: `... and ${c.issues.statusMismatches.length - 100} more`, colSpan: 5, italics: true }, '', '', '', '']);
  nodes.push(smallTable(rows, [80, '*', 30, 80, 80]));
}

export function buildHistoryMismatches(c, nodes) {
  if (!c.issues?.statusHistoryMismatches?.length) return;
  nodes.push({ text: `Issue Status History Mismatches (${c.issues.statusHistoryMismatches.length})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('Line'), h('SQ Transitions'), h('SC Transitions'), h('Missing')]];
  for (const m of c.issues.statusHistoryMismatches.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 25), String(m.line), m.sqTransitions.join(' → '), m.scTransitions.join(' → ') || 'none', m.missingTransitions.join(', ')]);
  }
  if (c.issues.statusHistoryMismatches.length > 100) rows.push([{ text: `... and ${c.issues.statusHistoryMismatches.length - 100} more`, colSpan: 6, italics: true }, '', '', '', '', '']);
  nodes.push(smallTable(rows, [65, 80, 25, '*', '*', 70]));
}
