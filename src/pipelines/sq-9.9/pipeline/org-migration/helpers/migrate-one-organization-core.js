import { initOrgClients } from './init-org-clients.js';
import { ensureRuleEnrichment } from './ensure-rule-enrichment.js';
import { loadOrRunOrgWide } from './load-or-run-org-wide.js';
import { runProjectCorePhase } from './run-project-core-phase.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Phase 1: Org-Wide Resources + Project Upload/Config --------

export async function migrateOneOrganizationCore(assignment, extractedData, resourceMappings, results, ctx) {
  const { org, projects } = assignment;
  if (projects.length === 0) { logger.info(`Skipping org ${org.key}: no projects assigned`); return null; }

  logger.info(`\n========================================\n=== Migrating to organization: ${org.key} (${projects.length} projects) ===\n========================================`);

  const orgStart = Date.now();
  const orgResult = { key: org.key, projectCount: projects.length, steps: [] };
  results.orgResults.push(orgResult);

  const migrationJournal = ctx.migrationJournal || null;
  if (migrationJournal) await migrationJournal.ensureOrg(org.key);

  const clients = await initOrgClients(org, orgResult, ctx);
  if (!clients) return null;
  const { scClient, sqClient } = clients;

  await ensureRuleEnrichment(ctx, scClient);
  const { gateMapping, builtInProfileMapping } = await loadOrRunOrgWide(org, extractedData, scClient, sqClient, orgResult, results, ctx);

  const coreResult = await runProjectCorePhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping);
  results.projectKeyWarnings.push(...coreResult.projectKeyWarnings);

  return {
    projectKeyMap: coreResult.projectKeyMap,
    orgPhase2Context: { org, projects, results, orgResult, orgStart, migrationJournal, projectPhase2Contexts: coreResult.projectPhase2Contexts },
  };
}
