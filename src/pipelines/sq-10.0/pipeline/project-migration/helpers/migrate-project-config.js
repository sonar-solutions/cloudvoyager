import logger from '../../../../../shared/utils/logger.js';
import { runProjectStep } from './run-project-step.js';
import { migrateProjectConfigSettings } from './migrate-project-config-settings.js';
import { migrateProjectConfigGates } from './migrate-project-config-gates.js';

// -------- Migrate Full Project Config --------

export async function migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, onlyComponents, journal = {}) {
  const { isStepDone: stepDone, recordStep: recStep } = journal;

  async function runGuardedStep(stepName, journalKey, fn) {
    if (stepDone && stepDone(journalKey)) {
      logger.info(`${stepName} — already completed, skipping`);
      projectResult.steps.push({ step: stepName, status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
      return;
    }
    await runProjectStep(projectResult, stepName, fn);
    const lastStep = projectResult.steps.at(-1);
    if (recStep && lastStep && lastStep.status !== 'failed') await recStep(journalKey);
  }

  await migrateProjectConfigSettings(project, scProjectKey, projectSqClient, projectScClient, extractedData, projectResult, onlyComponents, runGuardedStep);
  await migrateProjectConfigGates(project, scProjectKey, projectSqClient, projectScClient, gateMapping, projectResult, builtInProfileMapping, onlyComponents, runGuardedStep);
}
