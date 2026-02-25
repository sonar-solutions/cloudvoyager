import { formatDuration, computeTotalDurationMs } from './shared.js';

export function sumDurations(steps) {
  return (steps || []).reduce((sum, s) => sum + (s.durationMs || 0), 0);
}

export function getStepDuration(project, stepName) {
  const step = project.steps.find(s => s.step === stepName);
  if (!step || step.durationMs == null) return '—';
  if (step.status === 'skipped') return 'skipped';
  return formatDuration(step.durationMs);
}

export function getConfigDuration(project) {
  const mainSteps = new Set(['Upload scanner report', 'Sync issues', 'Sync hotspots']);
  const configSteps = project.steps.filter(s => !mainSteps.has(s.step));
  const total = configSteps.reduce((sum, s) => sum + (s.durationMs || 0), 0);
  return total > 0 ? formatDuration(total) : '—';
}

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
    const dur = step.durationMs || 0;
    stepTypeTotals.set(`[Server] ${step.step}`, (stepTypeTotals.get(`[Server] ${step.step}`) || 0) + dur);
  }
  for (const org of (results.orgResults || [])) {
    for (const step of (org.steps || [])) {
      const dur = step.durationMs || 0;
      const key = `[Org] ${step.step}`;
      stepTypeTotals.set(key, (stepTypeTotals.get(key) || 0) + dur);
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
