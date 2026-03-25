// -------- Build Header --------
import { formatTimestamp, computeTotalDurationMs, formatDuration } from '../../shared.js';

export function buildHeader(results) {
  const durationMs = computeTotalDurationMs(results);
  const nodes = [
    { text: 'CloudVoyager Migration — Performance Report', style: 'title' },
    { text: `Started: ${formatTimestamp(results.startTime) || results.startTime}`, style: 'metadata' },
    { text: `Finished: ${formatTimestamp(results.endTime) || 'In progress'}`, style: 'metadata' },
  ];
  if (durationMs != null) {
    nodes.push({ text: `Total Duration: ${formatDuration(durationMs)}`, style: 'metadata' });
  }
  return nodes;
}
