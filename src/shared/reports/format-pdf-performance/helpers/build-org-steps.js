// -------- Build Org Steps --------
import { formatDuration } from '../../shared.js';
import { statusStyle, statusText } from '../../pdf-helpers.js';
import { h, c, dur, sumDurations } from './pdf-cell-helpers.js';

export function buildOrgSteps(results) {
  if (!results.orgResults || results.orgResults.length === 0) return [];
  const nodes = [];
  for (const org of results.orgResults) {
    nodes.push({ text: `Organization: ${org.key}`, style: 'heading' });
    if (org.durationMs != null) {
      nodes.push({ text: `Total org migration time: ${formatDuration(org.durationMs)}`, style: 'metadata' });
    }
    if (org.steps && org.steps.length > 0) {
      const body = [[h('Step'), h('Duration'), h('Status'), h('Detail')]];
      for (const step of org.steps) {
        body.push([
          c(step.step), c(dur(step.durationMs)),
          { text: statusText(step.status), style: statusStyle(step.status) },
          c(step.detail || step.error || ''),
        ]);
      }
      const total = sumDurations(org.steps);
      body.push([
        { text: 'Total (org steps)', bold: true, fontSize: 9 },
        { text: formatDuration(total), bold: true, fontSize: 9 }, '', '',
      ]);
      nodes.push({ table: { headerRows: 1, widths: ['*', 100, 60, '*'], body }, layout: 'lightHorizontalLines' });
    }
  }
  return nodes;
}
