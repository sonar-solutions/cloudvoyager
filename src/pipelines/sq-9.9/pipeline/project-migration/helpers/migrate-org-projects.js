import { migrateOrgProjectsCorePhase } from './migrate-org-projects-core-phase.js';
import { migrateOrgProjectsMetadataPhase } from './migrate-org-projects-metadata-phase.js';

// -------- Full Project Migration (convenience wrapper) --------

export async function migrateOrgProjects(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const coreResult = await migrateOrgProjectsCorePhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping);
  await migrateOrgProjectsMetadataPhase(coreResult.projectPhase2Contexts, projects, results);
  return { projectKeyMap: coreResult.projectKeyMap, projectKeyWarnings: coreResult.projectKeyWarnings };
}
