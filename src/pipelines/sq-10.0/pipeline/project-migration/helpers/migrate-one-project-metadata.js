import logger from '../../../../../shared/utils/logger.js';
import { finalizeProjectResult } from '../../results.js';
import { syncProjectIssues } from './sync-project-issues.js';
import { syncProjectHotspots } from './sync-project-hotspots.js';

// -------- Migrate One Project: Metadata Phase --------

export async function migrateOneProjectMetadata(phase2Ctx) {
  const { project, scProjectKey, org, ctx, projectResult, projectStart, reportUploadOk, projectSqClient, projectScClient, isStepDone, recordStep, shouldRun, only } = phase2Ctx;
  const migrationJournal = ctx.migrationJournal || null;

  await Promise.all([
    (async () => {
      if (shouldRun('issue-metadata')) {
        if (isStepDone('sync_issues')) {
          logger.info(`[${project.key}] Issue sync — already completed, skipping`);
          projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
        } else {
          await syncProjectIssues(projectResult, phase2Ctx.results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key);
          const last = projectResult.steps.at(-1);
          if (last && last.status !== 'failed') await recordStep('sync_issues');
        }
      } else if (only) {
        projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
    (async () => {
      if (shouldRun('hotspot-metadata')) {
        if (isStepDone('sync_hotspots')) {
          logger.info(`[${project.key}] Hotspot sync — already completed, skipping`);
          projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
        } else {
          await syncProjectHotspots(projectResult, phase2Ctx.results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key);
          const last = projectResult.steps.at(-1);
          if (last && last.status !== 'failed') await recordStep('sync_hotspots');
        }
      } else if (only) {
        projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
  ]);

  finalizeProjectResult(projectResult);
  projectResult.durationMs = Date.now() - projectStart;
  if (migrationJournal) {
    if (projectResult.status === 'success') await migrationJournal.markProjectCompleted(org.key, project.key);
    else await migrationJournal.markProjectFailed(org.key, project.key, projectResult.errors?.[0] || 'Unknown error');
  }
  return projectResult;
}
