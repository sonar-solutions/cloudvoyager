// -------- Format Report Header --------
import { formatTimestamp, formatDuration } from '../../shared.js';

export function formatReportHeader(lines, results, sep) {
  lines.push(sep, 'CLOUDVOYAGER MIGRATION REPORT', sep, '',
    `Started:  ${formatTimestamp(results.startTime) || results.startTime}`,
    `Finished: ${formatTimestamp(results.endTime) || 'In progress'}`);
  if (results.startTime && results.endTime) {
    const durationMs = new Date(results.endTime) - new Date(results.startTime);
    lines.push(`Duration: ${formatDuration(durationMs)}`);
  }
  if (results.dryRun) {
    lines.push('Mode:     DRY RUN (no data migrated)');
  }
  lines.push('');
}
