import { syncProjectHotspots } from './sync-project-hotspots.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Conditionally sync hotspots for a project, respecting journal and --only flags.
 */
export async function syncHotspotsIfNeeded(project, projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, shouldRun, only, isStepDone, recordStep) {
  if (!shouldRun('hotspot-metadata')) {
    if (only) projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    return;
  }
  if (isStepDone('sync_hotspots')) {
    logger.info(`[${project.key}] Hotspot sync — already completed, skipping`);
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    return;
  }
  await syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key);
  const lastStep = projectResult.steps.at(-1);
  if (lastStep && lastStep.status !== 'failed') await recordStep('sync_hotspots');
}
