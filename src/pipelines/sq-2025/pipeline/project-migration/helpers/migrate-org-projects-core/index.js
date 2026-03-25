import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';
import { resolveProjectKey } from '../resolve-project-key.js';
import { migrateOneProjectCore } from '../migrate-one-project-core.js';
import { processCoreResults } from './helpers/process-core-results.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Phase 1: Upload + Config --------

/** Phase 1: Upload + config for all projects in an org. */
export async function migrateOrgProjectsCorePhase(projects, org, scClient, gateMapping, extractedData, results, ctx, builtInProfileMapping) {
  const projectKeyMap = new Map();
  const projectKeyWarnings = [];
  const projectPhase2Contexts = [];
  const migrationJournal = ctx.migrationJournal || null;

  const coreResults = await mapConcurrent(projects, async (project, i) => {
    if (migrationJournal && migrationJournal.getProjectStatus(org.key, project.key) === 'completed') {
      logger.info(`\n--- Project ${i + 1}/${projects.length}: ${project.key} — already completed ---`);
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
  }, { concurrency: ctx.perfConfig?.projectMigration?.concurrency || 1, settled: true, onProgress: createProgressLogger('Projects (upload+config)', projects.length) });

  processCoreResults(coreResults, results);
  return { projectKeyMap, projectKeyWarnings, projectPhase2Contexts };
}
