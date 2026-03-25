import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { matchHotspots } from './helpers/match-hotspots.js';
import { syncOneHotspot } from './helpers/sync-one-hotspot.js';

// -------- Re-exports --------

export { mapHotspotChangelogDiffToAction, extractHotspotTransitionsFromChangelog } from './helpers/map-hotspot-changelog.js';

// -------- Sync Hotspots --------

/** Sync hotspot statuses, comments, and source links from SQ to SC. */
export async function syncHotspots(projectKey, sqHotspots, client, options = {}) {
  const concurrency = options.concurrency || 3;
  const stats = { matched: 0, statusChanged: 0, commented: 0, metadataSyncCommented: 0, sourceLinked: 0, failed: 0 };

  const scHotspots = await client.searchHotspots(projectKey);
  logger.info(`Found ${scHotspots.length} SC hotspots, matching against ${sqHotspots.length} SQ hotspots`);

  const matchedPairs = matchHotspots(sqHotspots, scHotspots);
  stats.matched = matchedPairs.length;

  if (matchedPairs.length === 0) {
    logSyncSummary(stats);
    return stats;
  }

  logger.info(`Syncing ${matchedPairs.length} hotspots with concurrency=${concurrency}`);
  await mapConcurrent(
    matchedPairs,
    async (pair) => syncOneHotspot(pair, client, options, stats),
    { concurrency, settled: true, onProgress: createProgressLogger('Hotspot sync', matchedPairs.length) },
  );

  logSyncSummary(stats);
  return stats;
}

function logSyncSummary(stats) {
  logger.info(`Hotspot sync: ${stats.matched} matched, ${stats.statusChanged} status changed, ${stats.commented} comments, ${stats.metadataSyncCommented} metadata-sync-commented, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
}
