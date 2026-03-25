import logger from '../../../../../../shared/utils/logger.js';
import { finalizeProjectResult } from '../../../results.js';
import { syncIssueBlock } from './helpers/sync-issue-block.js';
import { syncHotspotBlock } from './helpers/sync-hotspot-block.js';
import { updateMigrationJournal } from './helpers/update-migration-journal.js';

// -------- Migrate One Project Metadata --------

/** Phase 2: issue + hotspot metadata sync for a single project. */
export async function migrateOneProjectMetadata(phase2Ctx) {
  const { project, org, ctx, results, projectResult, projectStart,
    reportUploadOk, projectSqClient, projectScClient,
    isStepDone, recordStep, shouldRun, only } = phase2Ctx;

  await Promise.all([
    syncIssueBlock(project, projectResult, results, reportUploadOk, ctx, phase2Ctx, isStepDone, recordStep, shouldRun, only),
    syncHotspotBlock(project, projectResult, results, reportUploadOk, ctx, phase2Ctx, isStepDone, recordStep, shouldRun, only),
  ]);

  logger.info(`[${project.key}] Project migration complete`);
  finalizeProjectResult(projectResult);
  projectResult.durationMs = Date.now() - projectStart;

  await updateMigrationJournal(ctx, org, project, projectResult);
  return projectResult;
}
