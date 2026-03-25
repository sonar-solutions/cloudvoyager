import { migrateOrgProjectsCorePhase, resolveProjectKey } from '../../../../project-migration.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Migrate Org Projects --------

/** Resolve project keys or run full project core migration. */
export async function migrateOrgProjects(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const only = ctx.onlyComponents;
  const PROJECT_COMPONENTS = ['scan-data', 'scan-data-all-branches', 'quality-gates', 'quality-profiles', 'permissions', 'issue-metadata', 'hotspot-metadata', 'project-settings'];
  const hasProjectWork = !only || PROJECT_COMPONENTS.some(c => only.includes(c));

  if (!hasProjectWork) {
    const projectKeyMap = new Map();
    for (const project of projects) {
      const { scProjectKey } = await resolveProjectKey(project, org, scClient);
      projectKeyMap.set(project.key, scProjectKey);
    }
    logger.info(`Skipping project migration. Resolved ${projectKeyMap.size} project key(s).`);
    return { projectKeyMap, projectKeyWarnings: [], projectPhase2Contexts: [] };
  }

  const sharedThrottler = { _lastPostTime: 0 };
  return migrateOrgProjectsCorePhase(projects, org, scClient, gateMapping, extractedData, results, { ...ctx, sharedThrottler }, builtInProfileMapping);
}
