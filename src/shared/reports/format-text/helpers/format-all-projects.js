// -------- Format All Projects --------
import { getProjectStatusIcon } from './step-helpers.js';

export function formatAllProjects(lines, results, subsep) {
  if (results.projects.length === 0) return;
  lines.push('ALL PROJECTS', subsep);
  for (const project of results.projects) {
    const failedSteps = project.steps.filter(s => s.status === 'failed');
    const icon = getProjectStatusIcon(project.status);
    const detail = failedSteps.length > 0
      ? ` (failed: ${failedSteps.map(s => s.step).join(', ')})`
      : '';
    lines.push(`  [${icon}] ${project.projectKey}${detail}`);
  }
  lines.push('');
}
