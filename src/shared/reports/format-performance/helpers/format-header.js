// -------- Format Header --------
import { formatTimestamp, computeTotalDurationMs, formatDuration } from '../../shared.js';

export function formatHeader(results) {
  const durationMs = computeTotalDurationMs(results);
  const lines = ['# CloudVoyager Migration — Performance Report\n'];
  lines.push(`**Started:** ${formatTimestamp(results.startTime) || results.startTime}  `);
  lines.push(`**Finished:** ${formatTimestamp(results.endTime) || 'In progress'}  `);
  if (durationMs != null) lines.push(`**Total Duration:** ${formatDuration(durationMs)}  `);
  lines.push('');
  return lines.join('\n');
}
