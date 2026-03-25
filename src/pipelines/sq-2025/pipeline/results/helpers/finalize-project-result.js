// -------- Finalize Project Result --------

/** Set the overall status of a project result based on step outcomes. */
export function finalizeProjectResult(projectResult) {
  const failedSteps = projectResult.steps.filter(s => s.status === 'failed');
  const nonSkippedSteps = projectResult.steps.filter(s => s.status !== 'skipped');
  if (failedSteps.length === 0) {
    projectResult.status = 'success';
  } else if (failedSteps.length === nonSkippedSteps.length) {
    projectResult.status = 'failed';
  } else {
    projectResult.status = 'partial';
  }
  projectResult.success = projectResult.status === 'success';
}
