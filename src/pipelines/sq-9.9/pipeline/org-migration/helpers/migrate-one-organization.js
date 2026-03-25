import { migrateOneOrganizationCore } from './migrate-one-organization-core.js';
import { migrateOneOrganizationMetadata } from './migrate-one-organization-metadata.js';

// -------- Full Org Migration (convenience wrapper) --------

export async function migrateOneOrganization(assignment, extractedData, resourceMappings, results, ctx) {
  const coreResult = await migrateOneOrganizationCore(assignment, extractedData, resourceMappings, results, ctx);
  if (!coreResult) return new Map();
  await migrateOneOrganizationMetadata(coreResult.orgPhase2Context);
  return coreResult.projectKeyMap;
}
