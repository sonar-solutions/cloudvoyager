// -------- Issue Detail Sections --------
import { formatUnmatchedSqIssues, formatScOnlyIssues, formatStatusMismatches, formatHistoryMismatches } from './issue-list-details.js';
import { formatAssignmentMismatches, formatCommentMismatches, formatTagMismatches, formatUnsyncableTypeChanges, formatUnsyncableSeverityChanges } from './issue-attr-details.js';

/**
 * Format issue-related detail sections.
 * @param {object} c - Project checks object
 * @param {string[]} lines - Array to push lines into
 */
export function formatIssueDetails(c, lines) {
  formatTypeBreakdown(c, lines);
  formatSeverityBreakdown(c, lines);
  formatUnmatchedSqIssues(c, lines);
  formatScOnlyIssues(c, lines);
  formatStatusMismatches(c, lines);
  formatHistoryMismatches(c, lines);
  formatAssignmentMismatches(c, lines);
  formatCommentMismatches(c, lines);
  formatTagMismatches(c, lines);
  formatUnsyncableTypeChanges(c, lines);
  formatUnsyncableSeverityChanges(c, lines);
}

function formatTypeBreakdown(c, lines) {
  if (!c.issues || (!Object.keys(c.issues.typeBreakdown?.sq || {}).length && !Object.keys(c.issues.typeBreakdown?.sc || {}).length)) return;
  const allTypes = [...new Set([...Object.keys(c.issues.typeBreakdown.sq || {}), ...Object.keys(c.issues.typeBreakdown.sc || {})])].sort();
  lines.push(`<details><summary>Issue Type Breakdown (SQ vs SC)</summary>\n`);
  lines.push(`| Type | SQ Count | SC Count | Delta |`);
  lines.push(`|------|----------|----------|-------|`);
  for (const type of allTypes) {
    const sq = c.issues.typeBreakdown.sq[type] || 0;
    const sc = c.issues.typeBreakdown.sc[type] || 0;
    const delta = sc - sq;
    lines.push(`| ${type} | ${sq} | ${sc} | ${delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`)} |`);
  }
  lines.push('\n</details>\n');
}

function formatSeverityBreakdown(c, lines) {
  if (!c.issues || (!Object.keys(c.issues.severityBreakdown?.sq || {}).length && !Object.keys(c.issues.severityBreakdown?.sc || {}).length)) return;
  const allSeverities = [...new Set([...Object.keys(c.issues.severityBreakdown.sq || {}), ...Object.keys(c.issues.severityBreakdown.sc || {})])].sort();
  lines.push(`<details><summary>Issue Severity Breakdown (SQ vs SC)</summary>\n`);
  lines.push(`| Severity | SQ Count | SC Count | Delta |`);
  lines.push(`|----------|----------|----------|-------|`);
  for (const sev of allSeverities) {
    const sq = c.issues.severityBreakdown.sq[sev] || 0;
    const sc = c.issues.severityBreakdown.sc[sev] || 0;
    const delta = sc - sq;
    lines.push(`| ${sev} | ${sq} | ${sc} | ${delta === 0 ? '0' : (delta > 0 ? `+${delta}` : `${delta}`)} |`);
  }
  lines.push('\n</details>\n');
}
