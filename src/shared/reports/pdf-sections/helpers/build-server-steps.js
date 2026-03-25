// -------- Build Server Steps --------
import { statusStyle, statusText } from '../../pdf-helpers.js';

export function buildServerSteps(results) {
  if (results.serverSteps.length === 0) return [];
  const body = [
    [{ text: 'Step', style: 'tableHeader' }, { text: 'Status', style: 'tableHeader' }, { text: 'Detail', style: 'tableHeader' }],
  ];
  for (const step of results.serverSteps) {
    body.push([
      { text: step.step, style: 'tableCell' },
      { text: statusText(step.status), style: statusStyle(step.status) },
      { text: step.detail || step.error || '', style: 'tableCell' },
    ]);
  }
  return [
    { text: 'Server-Wide Steps', style: 'heading' },
    { table: { headerRows: 1, widths: ['*', 50, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
