import { migrateOrgProjectsMetadataPhase } from '../../project-migration.js';

// -------- Phase 2: Org Metadata Migration --------

export async function migrateOneOrganizationMetadata(orgPhase2Context) {
  const { org, projects, results, orgResult, orgStart, migrationJournal, projectPhase2Contexts } = orgPhase2Context;
  if (projectPhase2Contexts.length > 0) {
    await migrateOrgProjectsMetadataPhase(projectPhase2Contexts, projects, results);
  }
  orgResult.durationMs = Date.now() - orgStart;
  if (migrationJournal) await migrationJournal.markOrgCompleted(org.key);
}
