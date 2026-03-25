import logger from '../../../../../shared/utils/logger.js';

// -------- Record Project Outcome --------

/** Log project outcome and record failed steps in results. */
export function recordProjectOutcome(project, projectResult, results) {
  const failedSteps = projectResult.steps.filter(s => s.status === 'failed');
  if (failedSteps.length > 0) {
    results.errors.push({
      project: project.key,
      failedSteps: failedSteps.map(s => ({ step: s.step, error: s.error })),
    });
  }
  if (projectResult.status === 'success') {
    logger.info(`Project ${project.key} migrated successfully`);
  } else if (projectResult.status === 'partial') {
    logger.warn(`Project ${project.key} partially migrated (${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.step).join(', ')})`);
  } else {
    logger.error(`Project ${project.key} FAILED (${failedSteps.length} step(s) failed: ${failedSteps.map(s => s.step).join(', ')})`);
  }
}
