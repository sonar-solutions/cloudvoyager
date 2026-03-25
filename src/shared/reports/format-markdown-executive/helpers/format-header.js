// -------- Format Header --------
import { formatTimestamp, formatDuration } from '../../shared.js';

export function formatHeader(results, durationMs) {
  const date = formatTimestamp(results.startTime) || 'Unknown';
  const lines = ['# CloudVoyager Migration — Executive Summary\n'];
  lines.push(`**Date:** ${date}  `);
  if (durationMs != null) lines.push(`**Duration:** ${formatDuration(durationMs)}  `);
  if (results.dryRun) lines.push('**Mode:** DRY RUN (no data migrated)  ');
  const orgCount = (results.orgResults || []).length;
  if (orgCount > 0) lines.push(`**Target Organizations:** ${orgCount}  `);
  lines.push('');
  return lines.join('\n');
}
