// -------- Format Problem Projects --------
import { statusIcon } from './status-icon.js';

export function formatProblemProjects(results) {
  const problemProjects = results.projects.filter(p => p.status !== 'success');
  if (problemProjects.length === 0) return null;
  const sections = ['## Failed / Partial Projects\n'];
  for (const project of problemProjects) {
    const statusLabel = project.status === 'failed' ? 'FAIL' : 'PARTIAL';
    sections.push(`### [${statusLabel}] ${project.projectKey}\n`);
    sections.push(`**SonarCloud key:** \`${project.scProjectKey}\`\n`);
    const lines = [
      '| Step | Status | Detail |',
      '|------|--------|--------|',
    ];
    for (const step of project.steps) {
      const detail = step.error || step.detail || '';
      lines.push(`| ${step.step} | ${statusIcon(step.status)} | ${detail} |`);
    }
    lines.push('');
    sections.push(lines.join('\n'));
  }
  return sections.join('\n');
}
