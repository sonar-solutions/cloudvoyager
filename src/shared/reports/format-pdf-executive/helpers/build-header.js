// -------- Build Header --------
import { formatTimestamp, computeTotalDurationMs, formatDuration } from '../../shared.js';

export function buildHeader(results) {
  const durationMs = computeTotalDurationMs(results);
  const date = formatTimestamp(results.startTime) || 'Unknown';
  const nodes = [
    { text: 'CloudVoyager Migration', style: 'title' },
    { text: 'Executive Summary', fontSize: 14, color: '#666666', margin: [0, 0, 0, 10] },
    { text: `Date: ${date}`, style: 'metadata' },
  ];
  if (durationMs != null) nodes.push({ text: `Duration: ${formatDuration(durationMs)}`, style: 'metadata' });
  if (results.dryRun) nodes.push({ text: 'Mode: DRY RUN (no data migrated)', style: 'metadata', bold: true });
  const orgCount = (results.orgResults || []).length;
  if (orgCount > 0) nodes.push({ text: `Target Organizations: ${orgCount}`, style: 'metadata' });
  return nodes;
}
