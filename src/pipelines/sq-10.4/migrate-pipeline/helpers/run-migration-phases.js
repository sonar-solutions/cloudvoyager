import { mapConcurrent } from '../../../../shared/utils/concurrency.js';
import { migrateOneOrganizationCore, migrateOneOrganizationMetadata, migrateEnterprisePortfolios } from '../../pipeline/org-migration.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Run Phase 1 (upload+config) and Phase 2 (portfolios + metadata) for all orgs.
 */
export async function runMigrationPhases(orgAssignments, extractedData, resourceMappings, results, ctx) {
  // Phase 1: upload + config for all orgs
  const orgCoreResults = await mapConcurrent(
    orgAssignments,
    async (assignment) => migrateOneOrganizationCore(assignment, extractedData, resourceMappings, results, ctx),
    { concurrency: orgAssignments.length, settled: true },
  );

  const mergedProjectKeyMap = new Map();
  const orgPhase2Contexts = [];
  for (const r of orgCoreResults) {
    if (r.status === 'fulfilled' && r.value) {
      for (const [sqKey, scKey] of r.value.projectKeyMap) mergedProjectKeyMap.set(sqKey, scKey);
      orgPhase2Contexts.push(r.value.orgPhase2Context);
    } else if (r.status === 'rejected') {
      logger.error(`Organization migration failed: ${r.reason?.message || r.reason}`);
    }
  }

  // Phase 2: portfolios + metadata sync in parallel
  const onlyComponents = ctx.onlyComponents;
  await Promise.all([
    (!onlyComponents || onlyComponents.includes('portfolios'))
      ? migrateEnterprisePortfolios(extractedData, mergedProjectKeyMap, results, ctx)
      : Promise.resolve(),
    ...orgPhase2Contexts.map(phase2Ctx => migrateOneOrganizationMetadata(phase2Ctx)),
  ]);
}
