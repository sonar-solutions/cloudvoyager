import logger from '../../../../../shared/utils/logger.js';

// -------- Run Project Step --------

/** Execute a project step with timing and error capture. */
export async function runProjectStep(projectResult, stepName, fn) {
  const start = Date.now();
  try {
    const result = await fn();
    const durationMs = Date.now() - start;
    if (result && result.skipped) {
      projectResult.steps.push({ step: stepName, status: 'skipped', detail: result.detail || '', durationMs });
    } else {
      projectResult.steps.push({ step: stepName, status: 'success', durationMs });
    }
  } catch (error) {
    projectResult.steps.push({ step: stepName, status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}

/** Run a journal-guarded step: skip if done, record on success. */
export async function runGuardedStep(projectResult, stepName, journalKey, stepDone, recStep, fn) {
  if (stepDone && stepDone(journalKey)) {
    logger.info(`${stepName} — already completed, skipping`);
    projectResult.steps.push({ step: stepName, status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    return;
  }
  await runProjectStep(projectResult, stepName, fn);
  const lastStep = projectResult.steps.at(-1);
  if (recStep && lastStep && lastStep.status !== 'failed') await recStep(journalKey);
}
