import { extractProjectPermissions } from '../../../sonarqube/extractors/permissions.js';
import { migrateProjectPermissions } from '../../../sonarcloud/migrators/permissions.js';

// -------- Main Logic --------

/**
 * Migrate project permissions from SonarQube to SonarCloud.
 */
export async function migrateProjectPermissionsStep(scProjectKey, projectSqClient, projectScClient, projectResult, onlyComponents, shouldRun, runGuardedStep) {
  if (!shouldRun('permissions')) {
    if (onlyComponents) projectResult.steps.push({ step: 'Project permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    return;
  }
  await runGuardedStep('Project permissions', 'project_permissions', async () => {
    const perms = await extractProjectPermissions(projectSqClient, projectSqClient.projectKey);
    await migrateProjectPermissions(scProjectKey, perms, projectScClient);
  });
}
