import logger from '../../../../../shared/utils/logger.js';
import { migrateOrgProjectsCorePhase, resolveProjectKey } from '../../project-migration.js';

// -------- Run Project Migration Phase --------

export async function runProjectPhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const only = ctx.onlyComponents;
  const PROJECT_COMPONENTS = ['scan-data', 'scan-data-all-branches', 'quality-gates', 'quality-profiles', 'permissions', 'issue-metadata', 'hotspot-metadata', 'project-settings'];
  const hasProjectWork = !only || PROJECT_COMPONENTS.some(c => only.includes(c));
  if (!hasProjectWork) {
    const projectKeyMap = new Map();
    for (const project of projects) {
      const { scProjectKey } = await resolveProjectKey(project, org, scClient);
      projectKeyMap.set(project.key, scProjectKey);
    }
    logger.info(`Skipping project migration (no project-level components in --only). Resolved ${projectKeyMap.size} project key(s).`);
    return { projectKeyMap, projectKeyWarnings: [], projectPhase2Contexts: [] };
  }
  const sharedThrottler = { _lastPostTime: 0 };
  const coreResult = await migrateOrgProjectsCorePhase(
    projects, org, scClient, gateMapping, extractedData, results, { ...ctx, sharedThrottler }, builtInProfileMapping,
  );
  return coreResult;
}
