// -------- Log Project Issues --------

import logger from '../../../utils/logger.js';

/**
 * Log issue-specific details for a project to the console.
 */
export function logProjectIssues(iss) {
  const parts = [`${iss.matched}/${iss.sqCount} matched`];
  if (iss.unmatched > 0) parts.push(`${iss.unmatched} unmatched`);
  if (iss.scOnlyIssues?.length > 0) parts.push(`${iss.scOnlyIssues.length} SC-only`);
  if (iss.creationDateMismatches?.length > 0) parts.push(`${iss.creationDateMismatches.length} creation date mismatches`);
  if (iss.statusMismatches?.length > 0) parts.push(`${iss.statusMismatches.length} status mismatches`);
  if (iss.statusHistoryMismatches?.length > 0) parts.push(`${iss.statusHistoryMismatches.length} status history mismatches`);
  if (iss.assignmentMismatches?.length > 0) parts.push(`${iss.assignmentMismatches.length} assignment mismatches`);
  if (iss.commentMismatches?.length > 0) parts.push(`${iss.commentMismatches.length} comment mismatches`);
  if (iss.tagMismatches?.length > 0) parts.push(`${iss.tagMismatches.length} tag mismatches`);
  if (iss.unsyncable?.typeChanges > 0) parts.push(`${iss.unsyncable.typeChanges} type changes (unsyncable)`);
  if (iss.unsyncable?.severityChanges > 0) parts.push(`${iss.unsyncable.severityChanges} severity changes (unsyncable)`);
  logger.info(`         Issues: ${parts.join(', ')}`);

  logBreakdownDiff('Types', iss.typeBreakdown?.sq, iss.typeBreakdown?.sc);
  logBreakdownDiff('Severities', iss.severityBreakdown?.sq, iss.severityBreakdown?.sc);
}

function logBreakdownDiff(label, sqMap = {}, scMap = {}) {
  if (Object.keys(sqMap).length === 0 && Object.keys(scMap).length === 0) return;
  const allKeys = [...new Set([...Object.keys(sqMap), ...Object.keys(scMap)])].sort();
  const diffs = allKeys.map(k => {
    const sq = sqMap[k] || 0;
    const sc = scMap[k] || 0;
    const delta = sc - sq;
    const deltaStr = delta === 0 ? '' : ` (${delta > 0 ? '+' : ''}${delta})`;
    return `${k}: SQ=${sq} SC=${sc}${deltaStr}`;
  });
  logger.info(`           ${label}: ${diffs.join(', ')}`);
}
