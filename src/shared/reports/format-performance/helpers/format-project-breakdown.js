// -------- Format Project Breakdown --------
import { formatNumber } from '../../shared.js';
import { getStepDuration, getConfigDuration } from '../../perf-tables.js';

export function formatProjectBreakdown(results) {
  if (results.projects.length === 0) return null;
  const sorted = [...results.projects].sort((a, b) => (b.durationMs || 0) - (a.durationMs || 0));
  const lines = [
    '## Per-Project Breakdown\n', 'Sorted by total duration (slowest first).\n',
    '| # | Project | LOC | Total | Report Upload | Issue Sync | Hotspot Sync | Config |',
    '|---|---------|-----|-------|---------------|------------|--------------|--------|',
  ];
  sorted.forEach((project, i) => {
    const total = project.durationMs != null ? formatNumber(project.durationMs) : '—';
    const loc = project.linesOfCode > 0 ? formatNumber(project.linesOfCode) : '—';
    const reportUpload = getStepDuration(project, 'Upload scanner report');
    const issueSync = getStepDuration(project, 'Sync issues');
    const hotspotSync = getStepDuration(project, 'Sync hotspots');
    const configDur = getConfigDuration(project);
    lines.push(`| ${i + 1} | \`${project.projectKey}\` | ${loc} | ${total} | ${reportUpload} | ${issueSync} | ${hotspotSync} | ${configDur} |`);
  });
  lines.push('');
  return lines.join('\n');
}
