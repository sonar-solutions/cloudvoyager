import { extractHotspots } from '../../../sonarqube/extractors/hotspots.js';
import { syncHotspots } from '../../../sonarcloud/migrators/hotspot-sync.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Sync Project Hotspots --------

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
