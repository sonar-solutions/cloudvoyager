import logger from '../../../../../shared/utils/logger.js';
import { syncIssues } from '../../../sonarcloud/migrators/issue-sync.js';

// -------- Sync Project Issues --------

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
    const stats = await syncIssues(scProjectKey, sqIssues, projectScClient, { concurrency: ctx.perfConfig.issueSync.concurrency, sqClient: projectSqClient, userMappings: ctx.userMappings });
    logger.info(`[${projectKey}] Issue sync: ${stats.matched} matched, ${stats.transitioned} transitioned`);
    results.issueSyncStats.matched += stats.matched;
    results.issueSyncStats.transitioned += stats.transitioned;
    results.issueSyncStats.assigned += stats.assigned;
    results.issueSyncStats.assignmentFailed += stats.assignmentFailed;
    results.issueSyncStats.failedAssignments.push(...stats.failedAssignments);
    const assignDetail = stats.assigned > 0 ? `, ${stats.assigned} assigned` + (stats.assignmentFailed > 0 ? `, ${stats.assignmentFailed} failed` : '') : '';
    projectResult.steps.push({ step: 'Sync issues', status: 'success', detail: `${stats.matched} matched, ${stats.transitioned} transitioned${assignDetail}`, durationMs: Date.now() - start });
  } catch (error) {
    projectResult.steps.push({ step: 'Sync issues', status: 'failed', error: error.message, durationMs: Date.now() - start });
    projectResult.errors.push(error.message);
  }
}
