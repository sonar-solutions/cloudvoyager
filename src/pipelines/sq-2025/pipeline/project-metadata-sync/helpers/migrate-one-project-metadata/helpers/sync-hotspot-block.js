import logger from '../../../../../../../shared/utils/logger.js';
import { syncProjectHotspots } from '../../sync-project-hotspots.js';

// -------- Sync Hotspot Block --------

/** Run hotspot metadata sync with journal guard. */
export async function syncHotspotBlock(project, projectResult, results, reportUploadOk, ctx, p2, isStepDone, recordStep, shouldRun, only) {
  if (!shouldRun('hotspot-metadata')) {
    if (only) projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
    return;
  }
  if (isStepDone('sync_hotspots')) {
    logger.info(`[${project.key}] Hotspot sync — already completed, skipping`);
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    return;
  }
  await syncProjectHotspots(projectResult, results, reportUploadOk, ctx, p2.scProjectKey, p2.projectSqClient, p2.projectScClient, project.key);
  const lastStep = projectResult.steps.at(-1);
  if (lastStep && lastStep.status !== 'failed') await recordStep('sync_hotspots');
}
