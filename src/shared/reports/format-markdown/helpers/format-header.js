// -------- Format Header --------
import { formatTimestamp, computeTotalDurationMs, formatDuration } from '../../shared.js';

export function formatHeader(results) {
  const lines = ['# CloudVoyager Migration Report\n'];
  lines.push(`**Started:** ${formatTimestamp(results.startTime) || results.startTime}  `);
  lines.push(`**Finished:** ${formatTimestamp(results.endTime) || 'In progress'}  `);
  const durationMs = computeTotalDurationMs(results);
  if (durationMs != null) {
    lines.push(`**Duration:** ${formatDuration(durationMs)}  `);
  }
  if (results.dryRun) {
    lines.push('**Mode:** DRY RUN (no data migrated)  ');
  }
  lines.push('');
  return lines.join('\n');
}
