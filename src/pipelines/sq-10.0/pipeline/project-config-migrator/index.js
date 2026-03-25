import logger from '../../../../shared/utils/logger.js';
import { runProjectStep } from './helpers/run-project-step.js';
import { migrateProjectSettingsGroup } from './helpers/migrate-project-settings-group.js';
import { migrateQualityAndPerms } from './helpers/migrate-quality-and-perms.js';

// -------- Re-exports --------

export { runGuardedStep } from './helpers/run-guarded-step.js';
export { runProjectStep } from './helpers/run-project-step.js';

// -------- Migrate Project Config --------

export async function migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, onlyComponents, journal = {}) {
  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);
  const { isStepDone: stepDone, recordStep: recStep } = journal;

  const guardedStep = async (stepName, journalKey, fn) => {
    if (stepDone && stepDone(journalKey)) {
      logger.info(`${stepName} — already completed, skipping`);
      projectResult.steps.push({ step: stepName, status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
      return;
    }
    await runProjectStep(projectResult, stepName, fn);
    const lastStep = projectResult.steps.at(-1);
    if (recStep && lastStep && lastStep.status !== 'failed') await recStep(journalKey);
  };

  if (shouldRun('project-settings')) {
    await migrateProjectSettingsGroup(project, scProjectKey, projectSqClient, projectScClient, extractedData, projectResult, guardedStep);
  } else if (onlyComponents) {
    for (const step of ['Project settings', 'Project tags', 'Project links', 'New code definitions', 'DevOps binding']) {
      projectResult.steps.push({ step, status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    }
  }

  await migrateQualityAndPerms(project, scProjectKey, projectSqClient, projectScClient, gateMapping, builtInProfileMapping, projectResult, onlyComponents, guardedStep);
}
