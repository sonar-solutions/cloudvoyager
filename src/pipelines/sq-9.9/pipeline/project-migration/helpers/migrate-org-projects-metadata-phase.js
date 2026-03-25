import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { recordProjectOutcome } from '../../results.js';
import { migrateOneProjectMetadata } from './migrate-one-project-metadata.js';

// -------- Phase 2: Issue + Hotspot Metadata Sync for All Projects --------

export async function migrateOrgProjectsMetadataPhase(projectPhase2Contexts, projects, results) {
  if (projectPhase2Contexts.length === 0) return;

  const concurrency = projectPhase2Contexts[0]?.ctx?.perfConfig?.projectMigration?.concurrency || 1;

  const metadataResults = await mapConcurrent(
    projectPhase2Contexts,
    async (phase2Ctx) => migrateOneProjectMetadata(phase2Ctx),
    { concurrency, settled: true, onProgress: createProgressLogger('Projects (metadata sync)', projectPhase2Contexts.length) },
  );

  for (const r of metadataResults) {
    if (r.status === 'fulfilled' && r.value) {
      results.projects.push(r.value);
      const origProject = projects.find(p => p.key === r.value.projectKey);
      if (origProject) recordProjectOutcome(origProject, r.value, results);
    } else if (r.status === 'rejected') {
      logger.error(`Project metadata sync failed: ${r.reason?.message || r.reason}`);
    }
  }
}
