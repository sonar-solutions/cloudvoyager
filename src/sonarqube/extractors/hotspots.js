import logger from '../../utils/logger.js';
import { mapConcurrent, createProgressLogger } from '../../utils/concurrency.js';

/**
 * Extract security hotspots from SonarQube with full details
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} [branch] - Branch name
 * @param {object} [options] - Performance options
 * @param {number} [options.concurrency=10] - Max concurrent hotspot detail fetches
 * @returns {Promise<Array>} Hotspots with details and comments
 */
export async function extractHotspots(client, branch = null, options = {}) {
  const concurrency = options.concurrency || 10;

  const filters = {};
  if (branch) {
    filters.branch = branch;
  }

  const hotspots = await client.getHotspots(filters);
  logger.info(`Found ${hotspots.length} hotspots, fetching details with concurrency=${concurrency}`);

  if (hotspots.length === 0) return [];

  const progressLogger = createProgressLogger('Hotspot details', hotspots.length);

  const detailed = await mapConcurrent(
    hotspots,
    async (hotspot) => {
      try {
        const details = await client.getHotspotDetails(hotspot.key);
        return {
          key: hotspot.key,
          component: hotspot.component,
          project: hotspot.project,
          securityCategory: hotspot.securityCategory,
          vulnerabilityProbability: hotspot.vulnerabilityProbability,
          status: hotspot.status,
          resolution: hotspot.resolution || null,
          line: hotspot.line,
          message: hotspot.message,
          assignee: hotspot.assignee || null,
          author: hotspot.author || null,
          creationDate: hotspot.creationDate,
          updateDate: hotspot.updateDate,
          rule: details.rule || {},
          comments: details.comment || [],
          changelog: details.changelog || []
        };
      } catch (error) {
        logger.warn(`Failed to get details for hotspot ${hotspot.key}: ${error.message}`);
        return {
          key: hotspot.key,
          component: hotspot.component,
          status: hotspot.status,
          resolution: hotspot.resolution || null,
          line: hotspot.line,
          message: hotspot.message,
          assignee: hotspot.assignee || null,
          comments: []
        };
      }
    },
    {
      concurrency,
      onProgress: progressLogger
    }
  );

  return detailed;
}
