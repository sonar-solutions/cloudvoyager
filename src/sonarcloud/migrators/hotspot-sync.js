import logger from '../../utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../utils/concurrency.js';

/**
 * Sync hotspot statuses, assignments, and comments from SonarQube to SonarCloud
 *
 * @param {string} projectKey - SonarCloud project key
 * @param {Array} sqHotspots - Hotspots extracted from SonarQube (with details)
 * @param {import('../api-client.js').SonarCloudClient} client - SonarCloud client
 * @param {object} [options] - Performance options
 * @param {number} [options.concurrency=3] - Max concurrent hotspot sync operations
 * @returns {Promise<object>} Sync statistics
 */
export async function syncHotspots(projectKey, sqHotspots, client, options = {}) {
  const concurrency = options.concurrency || 3;

  const stats = {
    matched: 0,
    statusChanged: 0,
    commented: 0,
    failed: 0
  };

  // Fetch all hotspots from SonarCloud for this project
  const scHotspots = await client.searchHotspots(projectKey);
  logger.info(`Found ${scHotspots.length} hotspots in SonarCloud, matching against ${sqHotspots.length} SonarQube hotspots`);

  // Build lookup map: rule + component + line -> SC hotspot
  const scHotspotMap = new Map();
  for (const hotspot of scHotspots) {
    const key = buildHotspotMatchKey(hotspot);
    if (key) {
      if (!scHotspotMap.has(key)) {
        scHotspotMap.set(key, []);
      }
      scHotspotMap.get(key).push(hotspot);
    }
  }

  // Pre-match all hotspots (sequential, fast in-memory)
  const matchedPairs = [];
  for (const sqHotspot of sqHotspots) {
    const matchKey = buildHotspotMatchKey(sqHotspot);
    if (!matchKey) continue;

    const candidates = scHotspotMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;

    const scHotspot = candidates.shift();
    matchedPairs.push({ sqHotspot, scHotspot });
  }

  stats.matched = matchedPairs.length;
  logger.info(`Matched ${matchedPairs.length} hotspots, syncing with concurrency=${concurrency}`);

  if (matchedPairs.length === 0) {
    logger.info(`Hotspot sync: ${stats.matched} matched, ${stats.statusChanged} status changed, ${stats.commented} comments, ${stats.failed} failed`);
    return stats;
  }

  const progressLogger = createProgressLogger('Hotspot sync', matchedPairs.length);

  await mapConcurrent(
    matchedPairs,
    async ({ sqHotspot, scHotspot }) => {
      try {
        // Sync status
        if (sqHotspot.status !== 'TO_REVIEW' && scHotspot.status === 'TO_REVIEW') {
          const resolution = mapHotspotResolution(sqHotspot);
          if (resolution) {
            try {
              await client.changeHotspotStatus(scHotspot.key, 'REVIEWED', resolution);
              stats.statusChanged++;
            } catch (error) {
              logger.debug(`Failed to change hotspot ${scHotspot.key} status: ${error.message}`);
            }
          }
        }

        // Sync comments
        for (const comment of (sqHotspot.comments || [])) {
          try {
            const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
            await client.addHotspotComment(scHotspot.key, text);
            stats.commented++;
          } catch (error) {
            logger.debug(`Failed to add comment to hotspot ${scHotspot.key}: ${error.message}`);
          }
        }
      } catch (error) {
        stats.failed++;
        logger.debug(`Failed to sync hotspot ${sqHotspot.key}: ${error.message}`);
      }
    },
    {
      concurrency,
      settled: true,
      onProgress: progressLogger
    }
  );

  logger.info(`Hotspot sync: ${stats.matched} matched, ${stats.statusChanged} status changed, ${stats.commented} comments, ${stats.failed} failed`);
  return stats;
}

/**
 * Build a match key for hotspots: rule + file + line
 */
function buildHotspotMatchKey(hotspot) {
  const ruleKey = hotspot.ruleKey || hotspot.rule?.key || hotspot.securityCategory || '';
  const component = hotspot.component || '';
  const filePath = component.includes(':') ? component.split(':').pop() : component;
  const line = hotspot.line || hotspot.textRange?.startLine || 0;

  if (!ruleKey || !filePath) return null;
  return `${ruleKey}|${filePath}|${line}`;
}

/**
 * Map SonarQube hotspot status/resolution to SonarCloud resolution
 */
function mapHotspotResolution(sqHotspot) {
  if (sqHotspot.resolution === 'SAFE' || sqHotspot.status === 'REVIEWED') {
    return 'SAFE';
  }
  if (sqHotspot.resolution === 'ACKNOWLEDGED') {
    return 'ACKNOWLEDGED';
  }
  if (sqHotspot.resolution === 'FIXED') {
    return 'FIXED';
  }
  return null;
}
