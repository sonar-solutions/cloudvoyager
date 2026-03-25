// -------- Format Bottleneck Analysis --------
import { formatDuration, computeTotalDurationMs } from '../../shared.js';

export function formatBottleneckAnalysis(results) {
  const durationMs = computeTotalDurationMs(results);
  if (durationMs == null || durationMs === 0) return null;
  const stepTypeTotals = new Map();
  for (const project of results.projects) {
    for (const step of project.steps) {
      const dur = step.durationMs || 0;
      stepTypeTotals.set(step.step, (stepTypeTotals.get(step.step) || 0) + dur);
    }
  }
  for (const step of results.serverSteps) {
    const key = `[Server] ${step.step}`;
    stepTypeTotals.set(key, (stepTypeTotals.get(key) || 0) + (step.durationMs || 0));
  }
  for (const org of (results.orgResults || [])) {
    for (const step of (org.steps || [])) {
      const key = `[Org] ${step.step}`;
      stepTypeTotals.set(key, (stepTypeTotals.get(key) || 0) + (step.durationMs || 0));
    }
  }
  if (stepTypeTotals.size === 0) return null;
  const sorted = [...stepTypeTotals.entries()].sort((a, b) => b[1] - a[1]);
  const totalStepTime = sorted.reduce((sum, [, dur]) => sum + dur, 0);
  const lines = [
    '## Bottleneck Analysis\n',
    'Cumulative time spent on each step type across all projects.\n',
    '| Step Type | Cumulative Time | % of Step Time |',
    '|-----------|-----------------|----------------|',
  ];
  for (const [stepName, dur] of sorted) {
    if (dur === 0) continue;
    const pct = ((dur / totalStepTime) * 100).toFixed(1);
    lines.push(`| ${stepName} | ${formatDuration(dur)} | ${pct}% |`);
  }
  lines.push(`| **Total** | **${formatDuration(totalStepTime)}** | **100%** |`);
  lines.push('');
  return lines.join('\n');
}
