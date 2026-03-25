import { finalizeProjectResult } from '../../../results.js';
import { syncIssueMetadata } from './helpers/sync-issue-metadata.js';
import { syncHotspotMetadata } from './helpers/sync-hotspot-metadata.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Metadata Sync (Phase 2) --------

/** Phase 2 of a single project: issue + hotspot metadata sync. */
export async function migrateOneProjectMetadata(phase2Ctx) {
  const { project, scProjectKey, org, ctx, results, projectResult, projectStart,
    reportUploadOk, projectSqClient, projectScClient,
    isStepDone, recordStep, shouldRun, only } = phase2Ctx;

  await Promise.all([
    syncIssueMetadata(project, scProjectKey, ctx, results, projectResult, reportUploadOk, projectSqClient, projectScClient, isStepDone, recordStep, shouldRun, only),
    syncHotspotMetadata(project, scProjectKey, ctx, results, projectResult, reportUploadOk, projectSqClient, projectScClient, isStepDone, recordStep, shouldRun, only),
  ]);

  logger.info(`[${project.key}] Project migration complete`);
  finalizeProjectResult(projectResult);
  projectResult.durationMs = Date.now() - projectStart;

  const mj = ctx.migrationJournal || null;
  if (mj) {
    if (projectResult.status === 'success') await mj.markProjectCompleted(org.key, project.key);
    else await mj.markProjectFailed(org.key, project.key, projectResult.errors?.[0] || 'Unknown error');
  }

  return projectResult;
}
