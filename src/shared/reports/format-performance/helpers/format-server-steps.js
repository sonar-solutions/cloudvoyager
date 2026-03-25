// -------- Format Server Steps --------
import { formatDuration } from '../../shared.js';
import { sumDurations } from '../../perf-tables.js';

export function formatServerSteps(results) {
  if (results.serverSteps.length === 0) return null;
  const lines = [
    '## Server-Wide Extraction\n',
    '| Step | Duration | Status |', '|------|----------|--------|',
  ];
  for (const step of results.serverSteps) {
    const dur = step.durationMs != null ? formatDuration(step.durationMs) : '—';
    lines.push(`| ${step.step} | ${dur} | ${step.status} |`);
  }
  const total = sumDurations(results.serverSteps);
  lines.push(`| **Total** | **${formatDuration(total)}** | |`);
  lines.push('');
  return lines.join('\n');
}
