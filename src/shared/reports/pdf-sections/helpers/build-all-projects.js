// -------- Build All Projects --------
import { statusStyle, statusText } from '../../pdf-helpers.js';

export function buildAllProjects(results) {
  if (results.projects.length === 0) return [];
  const body = [
    [{ text: '#', style: 'tableHeader' }, { text: 'Project Key', style: 'tableHeader' }, { text: 'LOC', style: 'tableHeader' }, { text: 'Status', style: 'tableHeader' }, { text: 'Failed Steps', style: 'tableHeader' }],
  ];
  results.projects.forEach((project, i) => {
    const failedSteps = project.steps.filter(s => s.status === 'failed');
    const loc = project.linesOfCode > 0 ? Number(project.linesOfCode).toLocaleString('en-US') : '—';
    body.push([
      { text: String(i + 1), style: 'tableCell' },
      { text: project.projectKey, style: 'tableCell' },
      { text: loc, style: 'tableCell' },
      { text: statusText(project.status), style: statusStyle(project.status) },
      { text: failedSteps.map(s => s.step).join(', '), style: 'tableCell' },
    ]);
  });
  return [
    { text: 'All Projects', style: 'heading', pageBreak: results.projects.length > 20 ? 'before' : undefined },
    { table: { headerRows: 1, widths: [25, '*', 55, 55, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
