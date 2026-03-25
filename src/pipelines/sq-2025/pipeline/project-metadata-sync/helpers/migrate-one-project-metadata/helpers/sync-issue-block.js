import logger from '../../../../../../../shared/utils/logger.js';
import { syncProjectIssues } from '../../sync-project-issues.js';

// -------- Sync Issue Block --------

/** Run issue metadata sync with journal guard. */
export async function syncIssueBlock(project, projectResult, results, reportUploadOk, ctx, p2, isStepDone, recordStep, shouldRun, only) {
  if (!shouldRun('issue-metadata')) {
    if (only) projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    return;
  }
  if (isStepDone('sync_issues')) {
    logger.info(`[${project.key}] Issue sync — already completed, skipping`);
    projectResult.steps.push({ step: 'Sync issues', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    return;
  }
  await syncProjectIssues(projectResult, results, reportUploadOk, ctx, p2.scProjectKey, p2.projectSqClient, p2.projectScClient, project.key);
  const lastStep = projectResult.steps.at(-1);
  if (lastStep && lastStep.status !== 'failed') await recordStep('sync_issues');
}
