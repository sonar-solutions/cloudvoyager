// -------- Format Failed Projects --------

export function formatFailedProjects(results) {
  const failedProjects = results.projects.filter(p => p.status === 'failed');
  if (failedProjects.length === 0) return null;
  const lines = [
    '## Failed Projects\n',
    '| Project Key | Failed Steps |',
    '|-------------|-------------|',
  ];
  for (const project of failedProjects) {
    const failedSteps = project.steps.filter(s => s.status === 'failed');
    lines.push(`| \`${project.projectKey}\` | ${failedSteps.map(s => s.step).join(', ')} |`);
  }
  lines.push('');
  return lines.join('\n');
}
