import logger from '../../../../../shared/utils/logger.js';
import { assignQualityGatesToProjects } from '../../../sonarcloud/migrators/quality-gates.js';
import { extractProjectPermissions } from '../../../sonarqube/extractors/permissions.js';
import { migrateProjectPermissions } from '../../../sonarcloud/migrators/permissions.js';

// -------- Migrate Project Config: Gates, Profiles, Permissions --------

export async function migrateProjectConfigGates(project, scProjectKey, projectSqClient, projectScClient, gateMapping, projectResult, builtInProfileMapping, onlyComponents, runGuardedStep) {
  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);
  await Promise.all([
    (async () => {
      if (shouldRun('quality-gates')) {
        await runGuardedStep('Assign quality gate', 'assign_quality_gate', async () => {
          const projectGate = await projectSqClient.getQualityGate();
          if (projectGate && gateMapping.has(projectGate.name)) {
            await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: projectGate.name }], projectScClient);
          }
        });
      } else if (onlyComponents) {
        projectResult.steps.push({ step: 'Assign quality gate', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('quality-profiles') && builtInProfileMapping?.size > 0) {
        await runGuardedStep('Assign quality profiles', 'assign_quality_profiles', async () => {
          let assigned = 0;
          for (const [language, profileName] of builtInProfileMapping) {
            try { await projectScClient.addQualityProfileToProject(language, profileName, scProjectKey); assigned++; }
            catch (e) { logger.debug(`Could not assign profile "${profileName}" (${language}): ${e.message}`); }
          }
          return `${assigned} profiles assigned`;
        });
      } else if (onlyComponents && builtInProfileMapping?.size > 0) {
        projectResult.steps.push({ step: 'Assign quality profiles', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('permissions')) {
        await runGuardedStep('Project permissions', 'project_permissions', async () => {
          const perms = await extractProjectPermissions(projectSqClient, project.key);
          await migrateProjectPermissions(scProjectKey, perms, projectScClient);
        });
      } else if (onlyComponents) {
        projectResult.steps.push({ step: 'Project permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
  ]);
}
