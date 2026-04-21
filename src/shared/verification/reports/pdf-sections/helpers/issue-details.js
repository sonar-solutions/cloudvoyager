// -------- PDF Issue Detail Sections --------

import { h, truncate, smallTable } from './pdf-table-utils.js';
import { buildUnmatchedSq, buildScOnly, buildStatusMismatches, buildHistoryMismatches } from './issue-list-details.js';
import { buildAssignmentMismatches, buildCommentMismatches, buildTagMismatches, buildUnsyncableTypes, buildUnsyncableSeverity } from './issue-attr-details.js';

/**
 * Build issue-related detail PDF nodes.
 * @param {object} c - Project checks object
 * @param {object[]} nodes - Array to push nodes into
 */
export function buildIssueDetails(c, nodes) {
  buildTypeBreakdown(c, nodes);
  buildSeverityBreakdown(c, nodes);
  buildUnmatchedSq(c, nodes);
  buildScOnly(c, nodes);
  buildStatusMismatches(c, nodes);
  buildHistoryMismatches(c, nodes);
  buildAssignmentMismatches(c, nodes);
  buildCommentMismatches(c, nodes);
  buildTagMismatches(c, nodes);
  buildUnsyncableTypes(c, nodes);
  buildUnsyncableSeverity(c, nodes);
}

function buildTypeBreakdown(c, nodes) {
  if (!c.issues || (!Object.keys(c.issues.typeBreakdown?.sq || {}).length && !Object.keys(c.issues.typeBreakdown?.sc || {}).length)) return;
  const allTypes = [...new Set([...Object.keys(c.issues.typeBreakdown.sq || {}), ...Object.keys(c.issues.typeBreakdown.sc || {})])].sort();
  nodes.push({ text: 'Issue Type Breakdown (SQ vs SC)', style: 'subheading' });
  const rows = [[h('Type'), h('SQ Count'), h('SC Count'), h('Delta')]];
  for (const type of allTypes) {
    const sq = c.issues.typeBreakdown.sq[type] || 0;
    const sc = c.issues.typeBreakdown.sc[type] || 0;
    const delta = sc - sq;
    rows.push([type, String(sq), String(sc), delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`)]);
  }
  nodes.push(smallTable(rows, [120, 80, 80, 80]));
}

function buildSeverityBreakdown(c, nodes) {
  if (!c.issues || (!Object.keys(c.issues.severityBreakdown?.sq || {}).length && !Object.keys(c.issues.severityBreakdown?.sc || {}).length)) return;
  const all = [...new Set([...Object.keys(c.issues.severityBreakdown.sq || {}), ...Object.keys(c.issues.severityBreakdown.sc || {})])].sort();
  nodes.push({ text: 'Issue Severity Breakdown (SQ vs SC)', style: 'subheading' });
  const rows = [[h('Severity'), h('SQ Count'), h('SC Count'), h('Delta')]];
  for (const sev of all) {
    const sq = c.issues.severityBreakdown.sq[sev] || 0;
    const sc = c.issues.severityBreakdown.sc[sev] || 0;
    const delta = sc - sq;
    rows.push([sev, String(sq), String(sc), delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`)]);
  }
  nodes.push(smallTable(rows, [120, 80, 80, 80]));
}
