// -------- Format Problem Projects --------

export function formatProblemProjects(lines, results, subsep) {
  const problemProjects = results.projects.filter(p => p.status !== 'success');
  if (problemProjects.length === 0) return;
  lines.push('FAILED / PARTIAL PROJECTS (DETAILED)', subsep);
  for (const project of problemProjects) {
    const statusLabel = project.status === 'failed' ? 'FAIL   ' : 'PARTIAL';
    lines.push(`  [${statusLabel}] ${project.projectKey} -> ${project.scProjectKey}`);
    for (const step of project.steps) {
      if (step.status === 'success') {
        lines.push(`    [OK  ] ${step.step}`);
      } else if (step.status === 'failed') {
        lines.push(`    [FAIL] ${step.step}`, `           ${step.error}`);
      } else if (step.status === 'skipped') {
        lines.push(`    [SKIP] ${step.step} -- ${step.detail || ''}`);
      }
    }
    lines.push('');
  }
}
