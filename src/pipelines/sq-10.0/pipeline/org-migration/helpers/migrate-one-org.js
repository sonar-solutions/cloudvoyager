import { migrateOneOrganizationCore } from './migrate-one-org-core.js';
import { migrateOneOrganizationMetadata } from './migrate-one-org-metadata.js';


// -------- Full Org Migration (backward compat wrapper) --------

export async function migrateOneOrganization(assignment, extractedData, resourceMappings, results, ctx) {
  const coreResult = await migrateOneOrganizationCore(assignment, extractedData, resourceMappings, results, ctx);
  if (!coreResult) return new Map();
  await migrateOneOrganizationMetadata(coreResult.orgPhase2Context);
  return coreResult.projectKeyMap;
}
