import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Record project migration outcome to results and log the status.
export function recordProjectOutcome(project, projectResult, results) {
  const failedSteps = projectResult.steps.filter(s => s.status === 'failed');

  if (failedSteps.length > 0) {
    results.errors.push({
      project: project.key,
      failedSteps: failedSteps.map(s => ({ step: s.step, error: s.error }))
    });
  }

  const failedNames = failedSteps.map(s => s.step).join(', ');

  if (projectResult.status === 'success') {
    logger.info(`Project ${project.key} migrated successfully`);
  } else if (projectResult.status === 'partial') {
    logger.warn(`Project ${project.key} partially migrated (${failedSteps.length} step(s) failed: ${failedNames})`);
  } else {
    logger.error(`Project ${project.key} FAILED (${failedSteps.length} step(s) failed: ${failedNames})`);
  }
}
