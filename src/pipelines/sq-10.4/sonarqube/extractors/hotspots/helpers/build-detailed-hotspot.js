import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch details for a hotspot and build the detailed hotspot object.
export async function buildDetailedHotspot(client, hotspot) {
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
}
