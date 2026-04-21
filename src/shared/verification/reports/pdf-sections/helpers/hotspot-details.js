// -------- PDF Hotspot Detail Sections --------

import { h, truncate, smallTable } from './pdf-table-utils.js';
import { buildCommentMismatches, buildUnsyncableAssignments } from './hotspot-extra-details.js';

/**
 * Build hotspot-related detail PDF nodes.
 */
export function buildHotspotDetails(c, nodes) {
  buildUnmatchedSq(c, nodes);
  buildScOnly(c, nodes);
  buildStatusMismatches(c, nodes);
  buildCommentMismatches(c, nodes);
  buildUnsyncableAssignments(c, nodes);
}

function buildUnmatchedSq(c, nodes) {
  if (!c.hotspots?.unmatchedSqHotspots?.length) return;
  nodes.push({ text: `Unmatched SQ Hotspots (${c.hotspots.unmatched})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('Line'), h('Status'), h('Message')]];
  for (const m of c.hotspots.unmatchedSqHotspots.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 30), String(m.line), m.status, truncate(m.message, 50)]);
  }
  if (c.hotspots.unmatched > 100) rows.push([{ text: `... and ${c.hotspots.unmatched - 100} more`, colSpan: 5, italics: true }, '', '', '', '']);
  nodes.push(smallTable(rows, [80, 100, 30, 60, '*']));
}

function buildScOnly(c, nodes) {
  if (!c.hotspots?.scOnlyHotspots?.length) return;
  nodes.push({ text: `SC-Only Hotspots (${c.hotspots.scOnlyHotspots.length})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('Line'), h('Status'), h('Message')]];
  for (const m of c.hotspots.scOnlyHotspots.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 30), String(m.line), m.status, truncate(m.message, 50)]);
  }
  if (c.hotspots.scOnlyHotspots.length > 100) rows.push([{ text: `... and more`, colSpan: 5, italics: true }, '', '', '', '']);
  nodes.push(smallTable(rows, [80, 100, 30, 60, '*']));
}

function buildStatusMismatches(c, nodes) {
  if (!c.hotspots?.statusMismatches?.length) return;
  nodes.push({ text: `Hotspot Status Mismatches (${c.hotspots.statusMismatches.length})`, style: 'subheading' });
  const rows = [[h('Rule'), h('File'), h('Line'), h('SQ Status'), h('SC Status')]];
  for (const m of c.hotspots.statusMismatches.slice(0, 100)) {
    rows.push([m.rule, truncate(m.file, 30), String(m.line), `${m.sqStatus}${m.sqResolution ? '/' + m.sqResolution : ''}`, `${m.scStatus}${m.scResolution ? '/' + m.scResolution : ''}`]);
  }
  if (c.hotspots.statusMismatches.length > 100) rows.push([{ text: `... and ${c.hotspots.statusMismatches.length - 100} more`, colSpan: 5, italics: true }, '', '', '', '']);
  nodes.push(smallTable(rows, [80, '*', 30, 80, 80]));
}
