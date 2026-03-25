import { syncProjectHotspots } from './sync-project-hotspots.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Conditionally Sync Hotspots --------

export async function syncHotspotsIfNeeded({ project, projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, shouldRun, only, isStepDone, recordStep }) {
  if (shouldRun('hotspot-metadata')) {
    if (isStepDone('sync_hotspots')) {
      logger.info(`[${project.key}] Hotspot sync — already completed, skipping`);
      projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Completed in previous run', durationMs: 0 });
    } else {
      await syncProjectHotspots(projectResult, results, reportUploadOk, ctx, scProjectKey, projectSqClient, projectScClient, project.key);
      const lastStep = projectResult.steps.at(-1);
      if (lastStep && lastStep.status !== 'failed') await recordStep('sync_hotspots');
    }
  } else if (only) {
    projectResult.steps.push({ step: 'Sync hotspots', status: 'skipped', detail: 'Not included in --only', durationMs: 0 });
  }
}
