// -------- Build Failed Projects --------

export function buildFailedProjects(results) {
  const failedProjects = results.projects.filter(p => p.status === 'failed');
  if (failedProjects.length === 0) return [];
  const body = [
    [{ text: 'Project Key', style: 'tableHeader' }, { text: 'Failed Steps', style: 'tableHeader' }],
  ];
  for (const project of failedProjects) {
    const failedSteps = project.steps.filter(s => s.status === 'failed');
    body.push([project.projectKey, failedSteps.map(s => s.step).join(', ')]);
  }
  return [
    { text: 'Failed Projects', style: 'heading' },
    { table: { headerRows: 1, widths: [200, '*'], body }, layout: 'lightHorizontalLines' },
  ];
}
