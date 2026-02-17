import logger from '../../utils/logger.js';

/**
 * Extract security hotspots from SonarQube with full details
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} [branch] - Branch name
 * @returns {Promise<Array>} Hotspots with details and comments
 */
export async function extractHotspots(client, branch = null) {
  const filters = {};
  if (branch) {
    filters.branch = branch;
  }

  const hotspots = await client.getHotspots(filters);
  logger.info(`Found ${hotspots.length} hotspots`);

  // Fetch details (including comments) for each hotspot
  const detailed = [];
  for (const hotspot of hotspots) {
    try {
      const details = await client.getHotspotDetails(hotspot.key);
      detailed.push({
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
      });
    } catch (error) {
      logger.warn(`Failed to get details for hotspot ${hotspot.key}: ${error.message}`);
      detailed.push({
        key: hotspot.key,
        component: hotspot.component,
        status: hotspot.status,
        resolution: hotspot.resolution || null,
        line: hotspot.line,
        message: hotspot.message,
        assignee: hotspot.assignee || null,
        comments: []
      });
    }
  }

  return detailed;
}
