import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../../shared/utils/concurrency.js';
import { matchHotspots } from './match-hotspots.js';
import { createSyncStats } from './create-sync-stats.js';
import { syncSingleHotspot } from './sync-single-hotspot.js';

// -------- Main Logic --------

// Sync hotspot statuses, assignments, and comments from SonarQube to SonarCloud.
export async function syncHotspots(projectKey, sqHotspots, client, options = {}) {
  const concurrency = options.concurrency || 3;
  const stats = createSyncStats();

  const scHotspots = await client.searchHotspots(projectKey);
  logger.info(`Found ${scHotspots.length} hotspots in SonarCloud, matching against ${sqHotspots.length} SonarQube hotspots`);

  const matchedPairs = matchHotspots(sqHotspots, scHotspots);
  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} hotspots, syncing with concurrency=${concurrency}`);

  if (matchedPairs.length > 0) {
    const progressLogger = createProgressLogger('Hotspot sync', matchedPairs.length);
    await mapConcurrent(matchedPairs, (pair) => syncSingleHotspot(pair, client, stats, options), { concurrency, settled: true, onProgress: progressLogger });
  }

  logger.info(`Hotspot sync: ${stats.matched} matched, ${stats.statusChanged} status changed, ${stats.commented} comments, ${stats.metadataSyncCommented} metadata-sync-commented, ${stats.sourceLinked} source-linked, ${stats.failed} failed`);
  return stats;
}
