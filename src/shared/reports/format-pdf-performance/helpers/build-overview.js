// -------- Build Overview --------
import { computeTotalDurationMs, formatDuration, formatNumber, computeTotalLoc, computeLocThroughput } from '../../shared.js';
import { h, sumDurations } from './pdf-cell-helpers.js';

export function buildOverview(results) {
  const durationMs = computeTotalDurationMs(results);
  const projectCount = results.projects.length;
  const avgPerProject = projectCount > 0 && durationMs != null
    ? formatDuration(Math.round(durationMs / projectCount)) : '—';
  const serverTotal = sumDurations(results.serverSteps);
  const body = [
    [h('Metric'), h('Value')],
    ['Total Duration', durationMs != null ? formatDuration(durationMs) : '—'],
    ['Projects Migrated', String(projectCount)],
    ['Average Time per Project', avgPerProject],
    ['Organizations', String((results.orgResults || []).length)],
  ];
  if (serverTotal > 0) body.push(['Server-Wide Extraction', formatDuration(serverTotal)]);
  for (const org of (results.orgResults || [])) {
    if (org.durationMs != null) body.push([`Org: ${org.key} (total)`, formatDuration(org.durationMs)]);
  }
  const totalLoc = computeTotalLoc(results);
  if (totalLoc > 0) {
    body.push(['Total Lines of Code', formatNumber(totalLoc)]);
    const throughput = computeLocThroughput(results);
    if (throughput.locPerMinute != null) {
      body.push(['LOC per Minute', formatNumber(throughput.locPerMinute)]);
      body.push(['LOC per Second', formatNumber(throughput.locPerSecond)]);
    }
    body.push(['Average LOC per Project', formatNumber(throughput.avgLocPerProject)]);
  }
  return [
    { text: 'Overview', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
