import { syncProjectIssues } from './sync-project-issues.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Conditionally sync issues for a project, respecting journal and --only flags.
 */
export async function syncIssuesIfNeeded(project, projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, shouldRun, only, isStepDone, recordStep) {
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
