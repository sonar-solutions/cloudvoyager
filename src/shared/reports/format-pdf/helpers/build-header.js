// -------- Build Header --------
import { formatTimestamp, computeTotalDurationMs, formatDuration } from '../../shared.js';

export function buildHeader(results) {
  const nodes = [];
  nodes.push({ text: 'CloudVoyager Migration Report', style: 'title' });
  const durationMs = computeTotalDurationMs(results);
  nodes.push({ text: `Started: ${formatTimestamp(results.startTime) || results.startTime}`, style: 'metadata' });
  nodes.push({ text: `Finished: ${formatTimestamp(results.endTime) || 'In progress'}`, style: 'metadata' });
  if (durationMs != null) nodes.push({ text: `Duration: ${formatDuration(durationMs)}`, style: 'metadata' });
  if (results.dryRun) nodes.push({ text: 'Mode: DRY RUN (no data migrated)', style: 'metadata', bold: true });
  return nodes;
}
