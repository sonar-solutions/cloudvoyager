import { mapConcurrent } from '../../../../../../shared/utils/concurrency.js';
import { migrateOneOrganizationCore, migrateOneOrganizationMetadata, migrateEnterprisePortfolios } from '../../../../pipeline/org-migration.js';
import { logMigrationSummary } from '../../../../pipeline/results.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Run Org Migrations --------

/** Execute org core migrations, portfolios, and metadata sync. */
export async function runOrgMigrations(effectiveOrgAssignments, effectiveExtractedData, effectiveResourceMappings, results, ctx) {
  const orgCoreResults = await mapConcurrent(effectiveOrgAssignments,
    async (assignment) => migrateOneOrganizationCore(assignment, effectiveExtractedData, effectiveResourceMappings, results, ctx),
    { concurrency: effectiveOrgAssignments.length, settled: true },
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

  const only = ctx.onlyComponents;
  await Promise.all([
    (!only || only.includes('portfolios')) ? migrateEnterprisePortfolios(effectiveExtractedData, mergedProjectKeyMap, results, ctx) : Promise.resolve(),
    ...orgPhase2Contexts.map(p2 => migrateOneOrganizationMetadata(p2)),
  ]);

  if (ctx.migrationJournal) await ctx.migrationJournal.markCompleted();
  logMigrationSummary(results, ctx.outputDir);
}
