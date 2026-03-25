import { migrateOrgProjectsMetadataPhase } from '../../project-migration.js';

// -------- Main Logic --------

/**
 * Phase 2: Issue + hotspot metadata sync for all projects in an org.
 */
export async function migrateOneOrganizationMetadata(orgPhase2Context) {
  const { org, projects, results, orgResult, orgStart, migrationJournal, projectPhase2Contexts } = orgPhase2Context;

  if (projectPhase2Contexts.length > 0) {
    await migrateOrgProjectsMetadataPhase(projectPhase2Contexts, projects, results);
  }

  orgResult.durationMs = Date.now() - orgStart;
  if (migrationJournal) await migrationJournal.markOrgCompleted(org.key);
}
