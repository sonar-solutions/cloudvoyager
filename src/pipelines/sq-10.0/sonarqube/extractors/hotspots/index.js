// -------- Extract Hotspots --------

import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { buildDetailedHotspot } from './helpers/build-detailed-hotspot.js';
import { buildFallbackHotspot } from './helpers/build-fallback-hotspot.js';

export async function extractHotspots(client, branch = null, options = {}) {
  const concurrency = options.concurrency || 10;
  const filters = {};
  if (branch) filters.branch = branch;

  const hotspots = await client.getHotspots(filters);
  logger.info(`Found ${hotspots.length} hotspots, fetching details with concurrency=${concurrency}`);
  if (hotspots.length === 0) return [];

  const progressLogger = createProgressLogger('Hotspot details', hotspots.length);

  const detailed = await mapConcurrent(
    hotspots,
    async (hotspot) => {
      try {
        const details = await client.getHotspotDetails(hotspot.key);
        return buildDetailedHotspot(hotspot, details);
      } catch (error) {
        logger.warn(`Failed to get details for hotspot ${hotspot.key}: ${error.message}`);
        return buildFallbackHotspot(hotspot);
      }
    },
    { concurrency, onProgress: progressLogger }
  );

  return detailed;
}
