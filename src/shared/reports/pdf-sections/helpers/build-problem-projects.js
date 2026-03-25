// -------- Build Problem Projects --------
import { statusStyle, statusText } from '../../pdf-helpers.js';

export function buildProblemProjects(results) {
  const problemProjects = results.projects.filter(p => p.status !== 'success');
  if (problemProjects.length === 0) return [];
  const nodes = [{ text: 'Failed / Partial Projects', style: 'heading' }];
  for (const project of problemProjects) {
    const label = project.status === 'failed' ? 'FAIL' : 'PARTIAL';
    nodes.push({ text: `[${label}] ${project.projectKey} -> ${project.scProjectKey}`, style: 'subheading' });
    const body = [
      [{ text: 'Step', style: 'tableHeader' }, { text: 'Status', style: 'tableHeader' }, { text: 'Detail', style: 'tableHeader' }],
    ];
    for (const step of project.steps) {
      body.push([
        { text: step.step, style: 'tableCell' },
        { text: statusText(step.status), style: statusStyle(step.status) },
        { text: step.error || step.detail || '', style: 'tableCell' },
      ]);
    }
    nodes.push({ table: { headerRows: 1, widths: ['*', 50, '*'], body }, layout: 'lightHorizontalLines' });
  }
  return nodes;
}
