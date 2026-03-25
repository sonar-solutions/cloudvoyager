// -------- Build PDF Header --------

import { formatTimestamp, formatDuration, computeTotalDurationMs } from '../../../../reports/shared.js';

/**
 * Build the PDF header section.
 * @param {object} results - Verification results
 * @returns {object[]} PDF content nodes
 */
export function buildHeader(results) {
  const nodes = [];
  nodes.push({ text: 'CloudVoyager Verification Report', style: 'title' });

  const meta = [];
  meta.push(`Started: ${formatTimestamp(results.startTime) || results.startTime}`);
  meta.push(`Finished: ${formatTimestamp(results.endTime) || 'In progress'}`);
  const durationMs = computeTotalDurationMs(results);
  if (durationMs != null) meta.push(`Duration: ${formatDuration(durationMs)}`);

  nodes.push({ text: meta.join('  |  '), style: 'metadata', margin: [0, 0, 0, 10] });
  return nodes;
}
