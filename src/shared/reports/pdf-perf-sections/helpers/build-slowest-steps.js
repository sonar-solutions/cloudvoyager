// -------- Build Slowest Steps --------
import { formatDuration } from '../../shared.js';
import { statusStyle, statusText } from '../../pdf-helpers.js';

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
