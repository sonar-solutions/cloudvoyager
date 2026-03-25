import { extractProjectPermissions } from '../../../sonarqube/extractors/permissions.js';
import { assignQualityGatesToProjects } from '../../../sonarcloud/migrators/quality-gates.js';
import { migrateProjectPermissions } from '../../../sonarcloud/migrators/permissions.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Migrate Quality Gates, Profiles, and Permissions --------

export async function migrateQualityAndPerms(project, scProjectKey, projectSqClient, projectScClient, gateMapping, builtInProfileMapping, projectResult, onlyComponents, guardedStep) {
  const shouldRun = (comp) => !onlyComponents || onlyComponents.includes(comp);

  await Promise.all([
    (async () => {
      if (shouldRun('quality-gates')) {
        await guardedStep('Assign quality gate', 'assign_quality_gate', async () => {
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
        await guardedStep('Assign quality profiles', 'assign_quality_profiles', async () => {
          let assigned = 0;
          for (const [language, profileName] of builtInProfileMapping) {
            try { await projectScClient.addQualityProfileToProject(language, profileName, scProjectKey); assigned++; }
            catch (error) { logger.debug(`Could not assign profile "${profileName}" (${language}) to ${scProjectKey}: ${error.message}`); }
          }
          return `${assigned} profiles assigned`;
        });
      } else if (onlyComponents && builtInProfileMapping?.size > 0) {
        projectResult.steps.push({ step: 'Assign quality profiles', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('permissions')) {
        await guardedStep('Project permissions', 'project_permissions', async () => {
          const projectPerms = await extractProjectPermissions(projectSqClient, project.key);
          await migrateProjectPermissions(scProjectKey, projectPerms, projectScClient);
        });
      } else if (onlyComponents) {
        projectResult.steps.push({ step: 'Project permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
  ]);
}
