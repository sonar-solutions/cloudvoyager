import logger from '../../../../../shared/utils/logger.js';
import { migrateOrgWideBatch1 } from './migrate-org-wide-batch1.js';
import { migrateOrgWideBatch2 } from './migrate-org-wide-batch2.js';
import { addSkippedSteps } from './add-skipped-steps.js';

// -------- Migrate Org-Wide Resources --------

/** Migrate all org-wide resources (groups, gates, profiles, templates, permissions). */
export async function migrateOrgWideResources(extractedData, scClient, sqClient, orgResult, results, ctx) {
  addSkippedSteps(orgResult, ctx);

  const { gateMapping, builtInProfileMapping } = await migrateOrgWideBatch1(
    extractedData, scClient, orgResult, results, ctx,
  );

  await migrateOrgWideBatch2(extractedData, scClient, sqClient, orgResult, results, ctx);

  return { gateMapping, builtInProfileMapping };
}
