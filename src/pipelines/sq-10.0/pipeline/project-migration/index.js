import { migrateOrgProjectsCorePhase } from './helpers/core-phase.js';
import { migrateOrgProjectsMetadataPhase } from './helpers/metadata-phase.js';

// -------- Project Migration (public API) --------

export { migrateOrgProjectsCorePhase } from './helpers/core-phase.js';
export { migrateOrgProjectsMetadataPhase } from './helpers/metadata-phase.js';
export { resolveProjectKey } from './helpers/resolve-project-key.js';

export async function migrateOrgProjects(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const coreResult = await migrateOrgProjectsCorePhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping);
  await migrateOrgProjectsMetadataPhase(coreResult.projectPhase2Contexts, projects, results);
  return { projectKeyMap: coreResult.projectKeyMap, projectKeyWarnings: coreResult.projectKeyWarnings };
}
