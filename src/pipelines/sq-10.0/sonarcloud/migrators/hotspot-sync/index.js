import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { waitForScIndexing } from '../../../../../shared/utils/issue-sync/wait-for-sc-indexing.js';
import { matchHotspots } from './helpers/match-hotspots.js';
import { syncSingleHotspot } from './helpers/sync-single-hotspot.js';
import { createEmptyHotspotStats } from './helpers/create-empty-hotspot-stats.js';
import { logHotspotSummary } from './helpers/log-hotspot-summary.js';

// -------- Re-exports --------

export { mapHotspotChangelogDiffToAction, extractHotspotTransitionsFromChangelog } from './helpers/hotspot-transition-mapping.js';

// -------- Sync Hotspots --------

export async function syncHotspots(projectKey, sqHotspots, client, options = {}) {
  const concurrency = options.concurrency || 3;
  const stats = createEmptyHotspotStats();

  let scHotspots = await client.searchHotspots(projectKey);
  if (scHotspots.length === 0 && sqHotspots.length > 0) {
    scHotspots = await waitForScIndexing(
      () => client.searchHotspots(projectKey),
      sqHotspots.length,
      { label: 'hotspots', projectKey },
    );
  }
  logger.info(`Found ${scHotspots.length} hotspots in SonarCloud, matching against ${sqHotspots.length} SonarQube hotspots`);

  const matchedPairs = matchHotspots(scHotspots, sqHotspots);
  stats.matched = matchedPairs.length;

  if (matchedPairs.length === 0) { logHotspotSummary(stats); return stats; }

  const progressLogger = createProgressLogger('Hotspot sync', matchedPairs.length);
  await mapConcurrent(
    matchedPairs,
    async ({ sqHotspot, scHotspot }) => syncSingleHotspot(sqHotspot, scHotspot, client, options, stats),
    { concurrency, settled: true, onProgress: progressLogger },
  );

  logHotspotSummary(stats);
  return stats;
}
