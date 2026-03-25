import logger from '../../../../../shared/utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../../../../shared/utils/concurrency.js';
import { buildHotspotDetail } from './helpers/build-hotspot-detail.js';

// -------- Extract Security Hotspots --------

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
    async (hotspot) => buildHotspotDetail(client, hotspot),
    { concurrency, onProgress: progressLogger }
  );

  return detailed;
}
