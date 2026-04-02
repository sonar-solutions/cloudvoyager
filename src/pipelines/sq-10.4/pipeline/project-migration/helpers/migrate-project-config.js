import logger from '../../../../../shared/utils/logger.js';
import { migrateProjectConfigSettings } from './migrate-project-config-settings.js';
import { migrateProjectConfigGates } from './migrate-project-config-gates.js';
import { runProjectStep } from './run-project-step.js';

// -------- Main Logic --------

/**
 * Migrate all project config: settings, quality gates, profiles, permissions.
 */
export async function migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, onlyComponents, journal = {}) {
  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);
  const { isStepDone: stepDone, recordStep: recStep } = journal;

  // Journal-guarded step: skip if done, record on success
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

  // Settings + gates run in parallel (fully independent)
  await Promise.all([
    migrateProjectConfigSettings(project, scProjectKey, projectSqClient, projectScClient, extractedData, projectResult, onlyComponents, shouldRun, runGuardedStep),
    migrateProjectConfigGates(scProjectKey, projectSqClient, projectScClient, gateMapping, projectResult, builtInProfileMapping, onlyComponents, shouldRun, runGuardedStep),
  ]);
}
