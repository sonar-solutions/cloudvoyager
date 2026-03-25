import { runProjectStep } from './run-project-step.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Journal-Guarded Project Step --------

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
