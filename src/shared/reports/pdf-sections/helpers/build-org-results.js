// -------- Build Org Results --------
import { statusStyle, statusText } from '../../pdf-helpers.js';

export function buildOrgResults(results) {
  if (!results.orgResults || results.orgResults.length === 0) return [];
  const nodes = [];
  for (const org of results.orgResults) {
    nodes.push({ text: `Organization: ${org.key} (${org.projectCount} projects)`, style: 'heading' });
    if (org.steps && org.steps.length > 0) {
      const body = [
        [{ text: 'Step', style: 'tableHeader' }, { text: 'Status', style: 'tableHeader' }, { text: 'Detail', style: 'tableHeader' }],
      ];
      for (const step of org.steps) {
        body.push([
          { text: step.step, style: 'tableCell' },
          { text: statusText(step.status), style: statusStyle(step.status) },
          { text: step.detail || step.error || '', style: 'tableCell' },
        ]);
      }
      nodes.push({ table: { headerRows: 1, widths: ['*', 50, '*'], body }, layout: 'lightHorizontalLines' });
    }
  }
  return nodes;
}
