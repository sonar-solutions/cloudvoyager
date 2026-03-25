// -------- Build Server Steps --------
import { formatDuration } from '../../shared.js';
import { statusStyle, statusText } from '../../pdf-helpers.js';
import { h, c, dur, sumDurations } from './pdf-cell-helpers.js';

export function buildServerSteps(results) {
  if (results.serverSteps.length === 0) return [];
  const body = [[h('Step'), h('Duration'), h('Status')]];
  for (const step of results.serverSteps) {
    body.push([
      c(step.step), c(dur(step.durationMs)),
      { text: statusText(step.status), style: statusStyle(step.status) },
    ]);
  }
  const total = sumDurations(results.serverSteps);
  body.push([
    { text: 'Total', bold: true, fontSize: 9 },
    { text: formatDuration(total), bold: true, fontSize: 9 }, '',
  ]);
  return [
    { text: 'Server-Wide Extraction', style: 'heading' },
    { table: { headerRows: 1, widths: ['*', 100, 60], body }, layout: 'lightHorizontalLines' },
  ];
}
