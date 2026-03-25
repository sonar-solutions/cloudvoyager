import { extractProjectPermissions } from '../../../sonarqube/extractors/permissions.js';
import { migrateProjectPermissions } from '../../../sonarcloud/migrators/permissions.js';
import { runGuardedStep } from './run-guarded-step.js';

// -------- Migrate Project Permissions --------

export async function migratePermsIfNeeded(project, scProjectKey, projectSqClient, projectScClient, projectResult, onlyComponents, stepDone, recStep, shouldRun) {
  if (shouldRun('permissions')) {
    await runGuardedStep(projectResult, 'Project permissions', 'project_permissions', stepDone, recStep, async () => {
      const projectPerms = await extractProjectPermissions(projectSqClient, project.key);
      await migrateProjectPermissions(scProjectKey, projectPerms, projectScClient);
    });
  } else if (onlyComponents) {
    projectResult.steps.push({ step: 'Project permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }
}
