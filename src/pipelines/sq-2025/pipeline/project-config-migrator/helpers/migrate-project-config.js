import logger from '../../../../../shared/utils/logger.js';
import { runProjectStep } from './run-project-step.js';
import { migrateProjectSettingsBlock } from './migrate-project-settings-block.js';
import { migrateGateProfilePerms } from './migrate-gate-profile-perms.js';

// -------- Migrate Project Config --------

/** Orchestrate project config migration (settings, gates, profiles, permissions). */
export async function migrateProjectConfig(project, scProjectKey, projectSqClient, projectScClient, gateMapping, extractedData, projectResult, builtInProfileMapping, onlyComponents, journal = {}) {
  const shouldRun = (c) => !onlyComponents || onlyComponents.includes(c);
  const { isStepDone: stepDone, recordStep: recStep } = journal;

  const guard = async (stepName, journalKey, fn) => {
    if (stepDone?.(journalKey)) {
      logger.info(`${stepName} — already completed, skipping`);
      projectResult.steps.push({ step: stepName, status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
      return;
    }
    await runProjectStep(projectResult, stepName, fn);
    const lastStep = projectResult.steps.at(-1);
    if (lastStep && lastStep.status !== 'failed') await recStep?.(journalKey);
  };

  // Settings + gates run in parallel (fully independent)
  await Promise.all([
    (async () => {
      if (shouldRun('project-settings')) {
        await migrateProjectSettingsBlock(project, scProjectKey, projectSqClient, projectScClient, extractedData, guard);
      } else if (onlyComponents) {
        for (const step of ['Project settings', 'Project tags', 'Project links', 'New code definitions', 'DevOps binding']) {
          projectResult.steps.push({ step, status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
        }
      }
    })(),
    migrateGateProfilePerms(project, scProjectKey, projectSqClient, projectScClient, gateMapping, builtInProfileMapping, projectResult, onlyComponents, guard),
  ]);
}
