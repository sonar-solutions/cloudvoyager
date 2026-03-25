// -------- Build Bottleneck Analysis --------
import { formatDuration, computeTotalDurationMs } from '../../shared.js';

function h(text) { return { text, style: 'tableHeader' }; }
function c(text) { return { text, style: 'tableCell' }; }

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
    body.push([c(stepName), c(formatDuration(d)), c(`${((d / totalStepTime) * 100).toFixed(1)}%`)]);
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
