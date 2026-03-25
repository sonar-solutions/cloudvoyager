import logger from '../../../../shared/utils/logger.js';
import { finalizeProjectResult } from '../results.js';
import { syncProjectIssues } from './helpers/sync-project-issues.js';
import { syncProjectHotspots } from './helpers/sync-project-hotspots.js';

// -------- Re-exports --------

export { syncProjectIssues } from './helpers/sync-project-issues.js';
export { syncProjectHotspots } from './helpers/sync-project-hotspots.js';

// -------- Migrate One Project Metadata --------

export async function migrateOneProjectMetadata(phase2Ctx) {
  const { project, org, ctx, results, projectResult, projectStart, reportUploadOk, projectSqClient, projectScClient, isStepDone, recordStep, shouldRun, only, scProjectKey } = phase2Ctx;
  const migrationJournal = ctx.migrationJournal || null;

  await Promise.all([
    (async () => {
      if (shouldRun('issue-metadata')) {
        if (isStepDone('sync_issues')) { logger.info(`[${project.key}] Issue sync — already completed, skipping`); projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 }); }
        else { await syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key); const ls = projectResult.steps.at(-1); if (ls && ls.status !== 'failed') await recordStep('sync_issues'); }
      } else if (only) { projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Not included in --only', durationMs: 0 }); }
    })(),
    (async () => {
      if (shouldRun('hotspot-metadata')) {
        if (isStepDone('sync_hotspots')) { logger.info(`[${project.key}] Hotspot sync — already completed, skipping`); projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 }); }
        else { await syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key); const ls = projectResult.steps.at(-1); if (ls && ls.status !== 'failed') await recordStep('sync_hotspots'); }
      } else if (only) { projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Not included in --only', durationMs: 0 }); }
    })(),
  ]);

  logger.info(`[${project.key}] Project migration complete`);
  finalizeProjectResult(projectResult);
  projectResult.durationMs = Date.now() - projectStart;

  if (migrationJournal) {
    if (projectResult.status === 'success') await migrationJournal.markProjectCompleted(org.key, project.key);
    else await migrationJournal.markProjectFailed(org.key, project.key, projectResult.errors?.[0] || 'Unknown error');
  }

  return projectResult;
}
