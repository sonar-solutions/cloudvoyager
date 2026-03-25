import { runGuardedStep } from './run-guarded-step.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Migrate Quality Profiles --------

export async function migrateProfilesIfNeeded(scProjectKey, projectScClient, projectResult, builtInProfileMapping, onlyComponents, stepDone, recStep, shouldRun) {
  if (!shouldRun('quality-profiles') || !builtInProfileMapping || builtInProfileMapping.size === 0) {
    if (onlyComponents && builtInProfileMapping && builtInProfileMapping.size > 0) {
      projectResult.steps.push({ step: 'Assign quality profiles', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    }
    return;
  }
  await runGuardedStep(projectResult, 'Assign quality profiles', 'assign_quality_profiles', stepDone, recStep, async () => {
    let assigned = 0;
    for (const [language, profileName] of builtInProfileMapping) {
      try { await projectScClient.addQualityProfileToProject(language, profileName, scProjectKey); assigned++; }
      catch (error) { logger.debug(`Could not assign profile "${profileName}" (${language}): ${error.message}`); }
    }
    return `${assigned} profiles assigned`;
  });
}
