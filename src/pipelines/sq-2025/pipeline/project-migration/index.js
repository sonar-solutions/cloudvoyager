export { migrateOrgProjectsCorePhase } from './helpers/migrate-org-projects-core.js';
export { migrateOrgProjectsMetadataPhase } from './helpers/migrate-org-projects-metadata.js';
export { resolveProjectKey } from './helpers/resolve-project-key.js';
export { migrateOneProjectCore } from './helpers/migrate-one-project-core.js';
export { migrateOneProjectMetadata } from './helpers/migrate-one-project-metadata.js';

// -------- Convenience Wrapper --------

/**
 * Full project migration (upload + config + metadata sync).
 * Kept as convenience wrapper for backward compatibility.
 */
export async function migrateOrgProjects(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const { migrateOrgProjectsCorePhase: corePhase } = await import('./helpers/migrate-org-projects-core.js');
  const { migrateOrgProjectsMetadataPhase: metaPhase } = await import('./helpers/migrate-org-projects-metadata.js');

  const coreResult = await corePhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping);
  await metaPhase(coreResult.projectPhase2Contexts, projects, results);
  return { projectKeyMap: coreResult.projectKeyMap, projectKeyWarnings: coreResult.projectKeyWarnings };
}
