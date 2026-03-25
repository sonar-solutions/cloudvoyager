// -------- Format Header Section --------

import { formatTimestamp, formatDuration, computeTotalDurationMs } from '../../../../reports/shared.js';

/**
 * Format the report header with timestamps and duration.
 * @param {object} results - Verification results
 * @returns {string}
 */
export function formatHeader(results) {
  const lines = ['# CloudVoyager Verification Report\n'];
  lines.push(`**Started:** ${formatTimestamp(results.startTime) || results.startTime}  `);
  lines.push(`**Finished:** ${formatTimestamp(results.endTime) || 'In progress'}  `);
  const durationMs = computeTotalDurationMs(results);
  if (durationMs != null) {
    lines.push(`**Duration:** ${formatDuration(durationMs)}  `);
  }
  lines.push('');
  return lines.join('\n');
}
