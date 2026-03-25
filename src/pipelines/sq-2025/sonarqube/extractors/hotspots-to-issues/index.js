import logger from '../../../../../shared/utils/logger.js';
import { convertHotspotToIssue } from './helpers/convert-hotspot-to-issue.js';

// -------- Extract Hotspots as Issues --------

/**
 * Extract security hotspots and convert them to issue format
 * so they can be included in the scanner report protobuf.
 */
export async function extractHotspotsAsIssues(client, branch = null) {
  const filters = {};
  if (branch) filters.branch = branch;

  const hotspots = await client.getHotspots(filters);
  logger.info(`Extracted ${hotspots.length} security hotspots for inclusion in scanner report`);

  if (hotspots.length === 0) return [];

  const validHotspots = hotspots.filter(h => h.key && h.ruleKey && h.component);
  if (validHotspots.length < hotspots.length) {
    logger.warn(`Filtered out ${hotspots.length - validHotspots.length} hotspots missing required fields`);
  }

  return validHotspots.map(convertHotspotToIssue);
}
