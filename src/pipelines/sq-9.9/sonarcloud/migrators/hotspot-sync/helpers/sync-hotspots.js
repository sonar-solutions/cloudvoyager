import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';
import { matchHotspots } from './match-hotspots.js';
import { syncHotspotStatus } from './sync-hotspot-status.js';
import { syncHotspotComments } from './sync-hotspot-comments.js';

// -------- Sync Hotspots from SonarQube to SonarCloud --------

export async function syncHotspots(projectKey, sqHotspots, client, options = {}) {
  const concurrency = options.concurrency || 3;
  const stats = { matched: 0, statusChanged: 0, commented: 0, metadataSyncCommented: 0, sourceLinked: 0, failed: 0 };

  const scHotspots = await client.searchHotspots(projectKey);
  logger.info(`Found ${scHotspots.length} SC hotspots, matching against ${sqHotspots.length} SQ hotspots`);

  const matchedPairs = matchHotspots(sqHotspots, scHotspots);
  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} hotspots, syncing with concurrency=${concurrency}`);

  if (matchedPairs.length === 0) { logHotspotStats(stats); return stats; }

  await mapConcurrent(
    matchedPairs,
    async ({ sqHotspot, scHotspot }) => {
      try {
        const changed = await syncHotspotStatus(scHotspot, sqHotspot, client);
        if (changed) stats.statusChanged++;
        await syncHotspotComments(scHotspot, sqHotspot, client, stats, options);
      } catch (e) { stats.failed++; logger.debug(`Failed to sync hotspot ${sqHotspot.key}: ${e.message}`); }
    },
    { concurrency, settled: true, onProgress: createProgressLogger('Hotspot sync', matchedPairs.length) },
  );

  logHotspotStats(stats);
  return stats;
}

function logHotspotStats(stats) {
  logger.info(`Hotspot sync: ${stats.matched} matched, ${stats.statusChanged} status changed, ${stats.commented} comments, ${stats.metadataSyncCommented} metadata-sync-commented, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
}
