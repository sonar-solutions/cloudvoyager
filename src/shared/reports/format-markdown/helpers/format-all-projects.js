// -------- Format All Projects --------
import { formatNumber } from '../../shared.js';

export function formatAllProjects(results) {
  if (results.projects.length === 0) return null;
  const lines = [
    '## All Projects\n',
    '| # | Project Key | LOC | Status | Failed Steps |',
    '|---|-------------|-----|--------|-------------|',
  ];
  results.projects.forEach((project, i) => {
    const failedSteps = project.steps.filter(s => s.status === 'failed');
    const failedList = failedSteps.length > 0 ? failedSteps.map(s => s.step).join(', ') : '';
    const status = project.status === 'success' ? 'OK' : project.status === 'partial' ? 'PARTIAL' : 'FAIL';
    const loc = project.linesOfCode > 0 ? formatNumber(project.linesOfCode) : '—';
    lines.push(`| ${i + 1} | \`${project.projectKey}\` | ${loc} | ${status} | ${failedList} |`);
  });
  lines.push('');
  return lines.join('\n');
}
