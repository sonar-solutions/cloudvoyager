import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { resolveProjectKey } from './resolve-project-key.js';
import { migrateOneProjectCore } from './migrate-one-project-core.js';

// -------- Phase 1: Upload + Config for All Projects --------

export async function migrateOrgProjectsCorePhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const projectKeyMap = new Map();
  const projectKeyWarnings = [];
  const projectPhase2Contexts = [];
  const migrationJournal = ctx.migrationJournal || null;
  const coreResults = await mapConcurrent(
    projects,
    async (project, i) => {
      if (migrationJournal && migrationJournal.getProjectStatus(org.key, project.key) === 'completed') {
        logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} — already completed, skipping ---`);
        const { scProjectKey } = await resolveProjectKey(project, org, scClient);
        projectKeyMap.set(project.key, scProjectKey);
        return null;
      }
      const { scProjectKey, warning } = await resolveProjectKey(project, org, scClient);
      if (warning) projectKeyWarnings.push(warning);
      projectKeyMap.set(project.key, scProjectKey);
      logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} -> ${scProjectKey} ---`);
      if (migrationJournal) await migrationJournal.startProject(org.key, project.key);
      const phase2Ctx = await migrateOneProjectCore({ project, scProjectKey, org, gateMapping, extractedData, results, ctx, builtInProfileMapping });
      projectPhase2Contexts.push(phase2Ctx);
      return phase2Ctx.projectResult;
    },
    { concurrency: ctx.perfConfig?.projectMigration?.concurrency || 1, settled: true, onProgress: createProgressLogger('Projects (upload+config)', projects.length) }
  );
  for (const r of coreResults) {
    if (r.status === 'fulfilled' && r.value) {
      if (r.value.linesOfCode > 0) {
        results.totalLinesOfCode += r.value.linesOfCode;
        results.projectLinesOfCode.push({ projectKey: r.value.projectKey, linesOfCode: r.value.linesOfCode });
      }
    } else if (r.status === 'rejected') {
      logger.error(`Project core migration failed: ${r.reason?.message || r.reason}`);
    }
  }
  return { projectKeyMap, projectKeyWarnings, projectPhase2Contexts };
}
