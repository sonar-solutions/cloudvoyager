import { migrateOneOrganizationMetadata, migrateEnterprisePortfolios } from '../../pipeline/org-migration.js';

// -------- Phase 2: Portfolios + Metadata Sync in Parallel --------

export async function runPhaseTwo(effectiveExtractedData, mergedProjectKeyMap, orgPhase2Contexts, results, ctx) {
  const shouldMigratePortfolios = !ctx.onlyComponents || ctx.onlyComponents.includes('portfolios');

  await Promise.all([
    shouldMigratePortfolios
      ? migrateEnterprisePortfolios(effectiveExtractedData, mergedProjectKeyMap, results, ctx)
      : Promise.resolve(),
    ...orgPhase2Contexts.map(phase2Ctx => migrateOneOrganizationMetadata(phase2Ctx)),
  ]);
}
