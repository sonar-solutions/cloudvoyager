import { extractProjectPermissions } from '../../../sonarqube/extractors/permissions.js';
import { assignQualityGatesToProjects } from '../../../sonarcloud/migrators/quality-gates.js';
import { migrateProjectPermissions } from '../../../sonarcloud/migrators/permissions.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Migrate Gate, Profile, Permissions Block --------

/** Run the parallel quality gate, profiles, and permissions block. */
export async function migrateGateProfilePerms(project, scProjectKey, projectSqClient, projectScClient, gateMapping, builtInProfileMapping, projectResult, onlyComponents, guard) {
  const shouldRun = (c) => !onlyComponents || onlyComponents.includes(c);

  await Promise.all([
    (async () => {
      if (shouldRun('quality-gates')) {
        await guard('Assign quality gate', 'assign_quality_gate', async () => {
          const g = await projectSqClient.getQualityGate();
          if (g && gateMapping.has(g.name)) await assignQualityGatesToProjects(gateMapping, [{ projectKey: scProjectKey, gateName: g.name }], projectScClient);
        });
      } else if (onlyComponents) {
        projectResult.steps.push({ step: 'Assign quality gate', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('quality-profiles') && builtInProfileMapping?.size > 0) {
        await guard('Assign quality profiles', 'assign_quality_profiles', async () => {
          let assigned = 0;
          for (const [lang, name] of builtInProfileMapping) {
            try { await projectScClient.addQualityProfileToProject(lang, name, scProjectKey); assigned++; }
            catch (e) { logger.debug(`Could not assign profile "${name}" (${lang}): ${e.message}`); }
          }
          return `${assigned} profiles assigned`;
        });
      } else if (onlyComponents && builtInProfileMapping?.size > 0) {
        projectResult.steps.push({ step: 'Assign quality profiles', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('permissions')) {
        await guard('Project permissions', 'project_permissions', async () => {
          const perms = await extractProjectPermissions(projectSqClient, project.key);
          await migrateProjectPermissions(scProjectKey, perms, projectScClient);
        });
      } else if (onlyComponents) {
        projectResult.steps.push({ step: 'Project permissions', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
  ]);
}
