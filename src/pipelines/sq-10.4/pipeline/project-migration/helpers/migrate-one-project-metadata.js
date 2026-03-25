import { syncIssuesIfNeeded } from './sync-issues-if-needed.js';
import { syncHotspotsIfNeeded } from './sync-hotspots-if-needed.js';
import { finalizeProjectResult } from '../../results.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Phase 2 of a single project: issue + hotspot metadata sync.
 */
export async function migrateOneProjectMetadata(phase2Ctx) {
  const { project, scProjectKey, org, ctx, results, projectResult, projectStart,
    reportUploadOk, projectSqClient, projectScClient,
    isStepDone, recordStep, shouldRun, only } = phase2Ctx;

  const migrationJournal = ctx.migrationJournal || null;

  await Promise.all([
    syncIssuesIfNeeded(project, projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, shouldRun, only, isStepDone, recordStep),
    syncHotspotsIfNeeded(project, projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, shouldRun, only, isStepDone, recordStep),
  ]);

  logger.info(`[${project.key}] Project migration complete`);
  finalizeProjectResult(projectResult);
  projectResult.durationMs = Date.now() - projectStart;

  if (migrationJournal) {
    if (projectResult.status === 'success') {
      await migrationJournal.markProjectCompleted(org.key, project.key);
    } else {
      await migrationJournal.markProjectFailed(org.key, project.key, projectResult.errors?.[0] || 'Unknown error');
    }
  }

  return projectResult;
}
