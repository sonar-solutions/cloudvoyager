import { syncIssues } from '../../../../../sonarcloud/migrators/issue-sync.js';
import logger from '../../../../../../../shared/utils/logger.js';

// -------- Sync Issue Metadata --------

/** Journal-guarded issue sync for a single project. */
export async function syncIssueMetadata(project, scProjectKey, ctx, results, projectResult, reportUploadOk, projectSqClient, projectScClient, isStepDone, recordStep, shouldRun, only) {
  if (!shouldRun('issue-metadata')) {
    if (only) projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    return;
  }
  if (isStepDone('sync_issues')) {
    logger.info(`[${project.key}] Issue sync — already completed, skipping`);
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    return;
  }
  await syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key);
  const lastStep = projectResult.steps.at(-1);
  if (lastStep && lastStep.status !== 'failed') await recordStep('sync_issues');
}

async function syncProjectIssues(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, projectKey) {
  if (ctx.skipIssueSync) { projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Disabled by config', durationMs: 0 }); return; }
  if (!reportUploadOk) { projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Report upload failed', durationMs: 0 }); return; }
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
