export { generateOrgMappings } from './helpers/generate-org-mappings.js';
export { saveServerInfo } from './helpers/save-server-info.js';
export { runOrgStep } from './helpers/run-org-step.js';
export { migrateOrgWideResources } from './helpers/migrate-org-wide-resources.js';
export { migrateOneOrganizationCore } from './helpers/migrate-one-org-core.js';
export { migrateOneOrganizationMetadata } from './helpers/migrate-one-org-metadata.js';
export { migrateEnterprisePortfolios } from './helpers/migrate-enterprise-portfolios.js';

// -------- Convenience Wrapper --------

import { migrateOneOrganizationCore } from './helpers/migrate-one-org-core.js';
import { migrateOneOrganizationMetadata } from './helpers/migrate-one-org-metadata.js';

/** Full org migration (upload + config + metadata sync). */
export async function migrateOneOrganization(assignment, extractedData, resourceMappings, results, ctx) {
  const coreResult = await migrateOneOrganizationCore(assignment, extractedData, resourceMappings, results, ctx);
  if (!coreResult) return new Map();
  await migrateOneOrganizationMetadata(coreResult.orgPhase2Context);
  return coreResult.projectKeyMap;
}
