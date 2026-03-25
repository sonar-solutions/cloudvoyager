// -------- Format Slowest Steps --------
import { formatDuration } from '../../shared.js';

export function formatSlowestSteps(results) {
  const allSteps = [];
  for (const project of results.projects) {
    for (const step of project.steps) {
      if (step.durationMs != null && step.durationMs > 0) {
        allSteps.push({ projectKey: project.projectKey, step: step.step, durationMs: step.durationMs, status: step.status });
      }
    }
  }
  if (allSteps.length === 0) return null;
  allSteps.sort((a, b) => b.durationMs - a.durationMs);
  const top = allSteps.slice(0, 10);
  const lines = [
    '## Slowest Individual Steps (Top 10)\n',
    '| # | Project | Step | Duration | Status |',
    '|---|---------|------|----------|--------|',
  ];
  top.forEach((entry, i) => {
    lines.push(`| ${i + 1} | \`${entry.projectKey}\` | ${entry.step} | ${formatDuration(entry.durationMs)} | ${entry.status} |`);
  });
  lines.push('');
  return lines.join('\n');
}
