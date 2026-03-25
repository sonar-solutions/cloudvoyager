import logger from '../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../shared/utils/concurrency.js';
import { migrateOneOrganizationCore, migrateOneOrganizationMetadata, migrateEnterprisePortfolios } from '../../pipeline/org-migration.js';

// -------- Run Migration Phases --------

export async function runPhase1(orgAssignments, extractedData, resourceMappings, results, ctx) {
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
  return { mergedProjectKeyMap, orgPhase2Contexts };
}

export async function runPhase2(extractedData, mergedProjectKeyMap, orgPhase2Contexts, results, ctx) {
  await Promise.all([
    (!ctx.onlyComponents || ctx.onlyComponents.includes('portfolios'))
      ? migrateEnterprisePortfolios(extractedData, mergedProjectKeyMap, results, ctx)
      : Promise.resolve(),
    ...orgPhase2Contexts.map(phase2Ctx => migrateOneOrganizationMetadata(phase2Ctx)),
  ]);
}
