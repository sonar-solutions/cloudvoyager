// -------- Format Overview --------
import { formatDuration, computeTotalDurationMs, formatNumber, computeTotalLoc, computeLocThroughput } from '../../shared.js';
import { sumDurations } from '../../perf-tables.js';

export function formatOverview(results) {
  const durationMs = computeTotalDurationMs(results);
  const projectCount = results.projects.length;
  const avgPerProject = projectCount > 0 && durationMs != null
    ? formatDuration(Math.round(durationMs / projectCount)) : '—';
  const lines = [
    '## Overview\n',
    '| Metric | Value |', '|--------|-------|',
    `| Total Duration | ${durationMs != null ? formatDuration(durationMs) : '—'} |`,
    `| Projects Migrated | ${projectCount} |`,
    `| Average Time per Project | ${avgPerProject} |`,
    `| Organizations | ${(results.orgResults || []).length} |`,
  ];
  const serverTotal = sumDurations(results.serverSteps);
  if (serverTotal > 0) lines.push(`| Server-Wide Extraction | ${formatDuration(serverTotal)} |`);
  for (const org of (results.orgResults || [])) {
    if (org.durationMs != null) lines.push(`| Org: ${org.key} (total) | ${formatDuration(org.durationMs)} |`);
  }
  const totalLoc = computeTotalLoc(results);
  if (totalLoc > 0) {
    lines.push(`| Total Lines of Code | ${formatNumber(totalLoc)} |`);
    const throughput = computeLocThroughput(results);
    if (throughput.locPerMinute != null) {
      lines.push(`| LOC per Minute | ${formatNumber(throughput.locPerMinute)} |`);
      lines.push(`| LOC per Second | ${formatNumber(throughput.locPerSecond)} |`);
    }
    lines.push(`| Average LOC per Project | ${formatNumber(throughput.avgLocPerProject)} |`);
  }
  lines.push('');
  return lines.join('\n');
}
