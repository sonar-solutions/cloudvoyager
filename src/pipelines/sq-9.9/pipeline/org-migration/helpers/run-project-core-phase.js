import { migrateOrgProjectsCorePhase, resolveProjectKey } from '../../project-migration.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Run Project Core Phase or Resolve Keys Only --------

const PROJECT_COMPONENTS = ['scan-data', 'scan-data-all-branches', 'quality-gates', 'quality-profiles', 'permissions', 'issue-metadata', 'hotspot-metadata', 'project-settings'];

export async function runProjectCorePhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const only = ctx.onlyComponents;
  const hasProjectWork = !only || PROJECT_COMPONENTS.some(c => only.includes(c));
  const sharedThrottler = { _lastPostTime: 0 };

  if (hasProjectWork) {
    return migrateOrgProjectsCorePhase(projects, org, scClient, gateMapping, extractedData, results, { ...ctx, sharedThrottler }, builtInProfileMapping);
  }

  // Fast path: only resolve project keys (needed for portfolio mapping)
  const projectKeyMap = new Map();
  for (const project of projects) {
    const { scProjectKey } = await resolveProjectKey(project, org, scClient);
    projectKeyMap.set(project.key, scProjectKey);
  }
  logger.info(`Skipping project migration (no project-level components in --only). Resolved ${projectKeyMap.size} project key(s).`);
  return { projectKeyMap, projectKeyWarnings: [], projectPhase2Contexts: [] };
}
