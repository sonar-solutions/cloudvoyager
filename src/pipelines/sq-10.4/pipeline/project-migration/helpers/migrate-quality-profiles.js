import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Migrate quality profile assignments for a project.
 */
export async function migrateQualityProfiles(scProjectKey, projectScClient, projectResult, builtInProfileMapping, onlyComponents, shouldRun, runGuardedStep) {
  if (!shouldRun('quality-profiles') || !builtInProfileMapping || builtInProfileMapping.size === 0) {
    if (onlyComponents && builtInProfileMapping && builtInProfileMapping.size > 0) {
      projectResult.steps.push({ step: 'Assign quality profiles', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    }
    return;
  }
  await runGuardedStep('Assign quality profiles', 'assign_quality_profiles', async () => {
    let assigned = 0;
    for (const [language, profileName] of builtInProfileMapping) {
      try {
        await projectScClient.addQualityProfileToProject(language, profileName, scProjectKey);
        assigned++;
      } catch (e) {
        logger.debug(`Could not assign profile "${profileName}" (${language}) to ${scProjectKey}: ${e.message}`);
      }
    }
    return `${assigned} profiles assigned`;
  });
}
