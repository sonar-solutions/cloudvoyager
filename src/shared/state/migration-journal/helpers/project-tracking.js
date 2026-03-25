// -------- Project Tracking --------

// Get a project's status within an organization
export function getProjectStatus(journal, orgKey, projectKey) {
  return journal.organizations[orgKey]?.projects?.[projectKey]?.status;
}

// Get the last completed step for an in-progress project
export function getProjectLastStep(journal, orgKey, projectKey) {
  const project = journal.organizations[orgKey]?.projects?.[projectKey];
  if (!project) return null;

  if (project.completedSteps && project.completedSteps.length > 0) {
    return project.completedSteps[project.completedSteps.length - 1];
  }

  return project.lastCompletedStep || null;
}

// Check if a specific project step has already been completed
export function isProjectStepCompleted(journal, orgKey, projectKey, stepName, stepOrder) {
  const project = journal.organizations[orgKey]?.projects?.[projectKey];
  if (!project) return false;

  if (project.completedSteps) {
    return project.completedSteps.includes(stepName);
  }

  const lastStep = project.lastCompletedStep;
  if (!lastStep) return false;
  const lastIdx = stepOrder.indexOf(lastStep);
  const currentIdx = stepOrder.indexOf(stepName);
  if (lastIdx === -1 || currentIdx === -1) return false;
  return currentIdx <= lastIdx;
}
