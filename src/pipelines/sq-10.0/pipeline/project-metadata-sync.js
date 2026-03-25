import { extractHotspots } from '../sonarqube/extractors/hotspots.js';
import { syncIssues } from '../sonarcloud/migrators/issue-sync.js';
import { syncHotspots } from '../sonarcloud/migrators/hotspot-sync.js';
import logger from '../../../shared/utils/logger.js';
import { finalizeProjectResult } from './results.js';

/**
 * Phase 2 of a single project: issue + hotspot metadata sync.
 * Takes the context returned by migrateOneProjectCore.
 */
export async function migrateOneProjectMetadata(phase2Ctx) {
  const { project, scProjectKey, org, ctx, results, projectResult, projectStart,
    reportUploadOk, projectSqClient, projectScClient,
    isStepDone, recordStep, shouldRun, only } = phase2Ctx;

  const migrationJournal = ctx.migrationJournal || null;

  // Issue + hotspot metadata sync (parallel)
  await Promise.all([
    (async () => {
      if (shouldRun('issue-metadata')) {
        if (isStepDone('sync_issues')) {
          logger.info(`[${project.key}] Issue sync — already completed, skipping`);
          projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
        } else {
          await syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key);
          const lastIssueStep = projectResult.steps.at(-1);
          if (lastIssueStep && lastIssueStep.status !== 'failed') await recordStep('sync_issues');
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
          await syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key);
          const lastHotspotStep = projectResult.steps.at(-1);
          if (lastHotspotStep && lastHotspotStep.status !== 'failed') await recordStep('sync_hotspots');
        }
      } else if (only) {
        projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
      }
    })(),
  ]);

  logger.info(`[${project.key}] Project migration complete`);
  finalizeProjectResult(projectResult);
  projectResult.durationMs = Date.now() - projectStart;

  // Update migration journal
  if (migrationJournal) {
    if (projectResult.status === 'success') {
      await migrationJournal.markProjectCompleted(org.key, project.key);
    } else {
      await migrationJournal.markProjectFailed(org.key, project.key, projectResult.errors?.[0] || 'Unknown error');
    }
  }

  return projectResult;
}

export async function syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, projectKey) {
  if (ctx.skipIssueSync) {
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Disabled by config', durationMs: 0 });
    return;
  }
  if (!reportUploadOk) {
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Report upload failed', durationMs: 0 });
    return;
  }
  const start = Date.now();
  try {
    logger.info(`[${projectKey}] Syncing issue metadata...`);
    const sqIssues = await projectSqClient.getIssuesWithComments();
    const issueStats = await syncIssues(scProjectKey, sqIssues, projectScClient, { concurrency: ctx.perfConfig.issueSync.concurrency, sqClient: projectSqClient, userMappings: ctx.userMappings });
    logger.info(`[${projectKey}] Issue sync: ${issueStats.matched} matched, ${issueStats.transitioned} transitioned`);
    results.issueSyncStats.matched += issueStats.matched;
    results.issueSyncStats.transitioned += issueStats.transitioned;
    results.issueSyncStats.assigned += issueStats.assigned;
    results.issueSyncStats.assignmentFailed += issueStats.assignmentFailed;
    results.issueSyncStats.failedAssignments.push(...issueStats.failedAssignments);
    const assignDetail = issueStats.assigned > 0 ? `, ${issueStats.assigned} assigned` + (issueStats.assignmentFailed > 0 ? `, ${issueStats.assignmentFailed} assignment-failed` : '') : '';
    projectResult.steps.push({ step: 'Sync issues', status: 'success', detail: `${issueStats.matched} matched, ${issueStats.transitioned} transitioned${assignDetail}`, durationMs: Date.now() - start });
  } catch (error) {
    projectResult.steps.push({ step: 'Sync issues', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}

export async function syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, projectKey) {
  if (ctx.skipHotspotSync) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Disabled by config', durationMs: 0 });
    return;
  }
  if (!reportUploadOk) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Report upload failed', durationMs: 0 });
    return;
  }
  const start = Date.now();
  try {
    logger.info(`[${projectKey}] Syncing hotspot metadata...`);
    const sqHotspots = await extractHotspots(projectSqClient, null, { concurrency: ctx.perfConfig.hotspotExtraction.concurrency });
    const hotspotStats = await syncHotspots(scProjectKey, sqHotspots, projectScClient, { concurrency: ctx.perfConfig.hotspotSync.concurrency, sonarqubeUrl: projectSqClient.baseURL, sonarqubeProjectKey: projectSqClient.projectKey });
    logger.info(`[${projectKey}] Hotspot sync: ${hotspotStats.matched} matched, ${hotspotStats.statusChanged} status changed`);
    results.hotspotSyncStats.matched += hotspotStats.matched;
    results.hotspotSyncStats.statusChanged += hotspotStats.statusChanged;
    projectResult.steps.push({ step: 'Sync hotspots', status: 'success', detail: `${hotspotStats.matched} matched, ${hotspotStats.statusChanged} status changed`, durationMs: Date.now() - start });
  } catch (error) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}
