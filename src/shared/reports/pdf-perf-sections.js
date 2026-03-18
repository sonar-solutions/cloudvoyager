import { formatDuration, computeTotalDurationMs } from './shared.js';
import { statusStyle, statusText } from './pdf-helpers.js';

function h(text) { return { text, style: 'tableHeader' }; }
function c(text) { return { text, style: 'tableCell' }; }

export function buildSlowestSteps(results) {
  const allSteps = [];
  for (const project of results.projects) {
    for (const step of project.steps) {
      if (step.durationMs != null && step.durationMs > 0) {
        allSteps.push({ projectKey: project.projectKey, step: step.step, durationMs: step.durationMs, status: step.status });
      }
    }
  }
  if (allSteps.length === 0) return [];
  allSteps.sort((a, b) => b.durationMs - a.durationMs);
  const top = allSteps.slice(0, 10);
  const body = [[h('#'), h('Project'), h('Step'), h('Duration'), h('Status')]];
  top.forEach((entry, i) => {
    body.push([
      c(String(i + 1)), c(entry.projectKey), c(entry.step),
      c(formatDuration(entry.durationMs)),
      { text: statusText(entry.status), style: statusStyle(entry.status) },
    ]);
  });
  return [
    { text: 'Slowest Individual Steps (Top 10)', style: 'heading' },
    { table: { headerRows: 1, widths: [20, '*', '*', 80, 50], body }, layout: 'lightHorizontalLines' },
  ];
}

export function buildBottleneckAnalysis(results) {
  const durationMs = computeTotalDurationMs(results);
  if (durationMs == null || durationMs === 0) return [];
  const stepTypeTotals = new Map();
  for (const project of results.projects) {
    for (const step of project.steps) {
      const d = step.durationMs || 0;
      stepTypeTotals.set(step.step, (stepTypeTotals.get(step.step) || 0) + d);
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
  if (stepTypeTotals.size === 0) return [];
  const sorted = [...stepTypeTotals.entries()].sort((a, b) => b[1] - a[1]);
  const totalStepTime = sorted.reduce((sum, [, d]) => sum + d, 0);
  const body = [[h('Step Type'), h('Cumulative Time'), h('% of Step Time')]];
  for (const [stepName, d] of sorted) {
    if (d === 0) continue;
    const pct = ((d / totalStepTime) * 100).toFixed(1);
    body.push([c(stepName), c(formatDuration(d)), c(`${pct}%`)]);
  }
  body.push([
    { text: 'Total', bold: true, fontSize: 9 },
    { text: formatDuration(totalStepTime), bold: true, fontSize: 9 },
    { text: '100%', bold: true, fontSize: 9 },
  ]);
  return [
    { text: 'Bottleneck Analysis', style: 'heading' },
    { text: 'Cumulative time spent on each step type across all projects.', style: 'small', margin: [0, 0, 0, 5] },
    { table: { headerRows: 1, widths: ['*', 120, 100], body }, layout: 'lightHorizontalLines' },
  ];
}
