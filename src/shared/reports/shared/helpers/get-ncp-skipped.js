// -------- Get NCP Skipped Projects --------

export function getNewCodePeriodSkippedProjects(results) {
  const skipped = [];
  for (const project of results.projects) {
    const ncpStep = project.steps.find(s => s.step === 'New code definitions' && s.status === 'skipped');
    if (ncpStep) skipped.push({ projectKey: project.projectKey, detail: ncpStep.detail });
  }
  return skipped;
}
