import logger from '../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../shared/utils/concurrency.js';
import { migrateOneOrganizationCore } from '../../pipeline/org-migration.js';

// -------- Phase 1: Upload + Config for All Organizations --------

export async function runPhaseOne(effectiveOrgAssignments, effectiveExtractedData, effectiveResourceMappings, results, ctx) {
  const orgCoreResults = await mapConcurrent(
    effectiveOrgAssignments,
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

  return { mergedProjectKeyMap, orgPhase2Contexts };
}
