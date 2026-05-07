import logger from '../../../../../../shared/utils/logger.js';
import { buildHotspotSourceComment } from '../../../../../../shared/utils/source-link/build-source-comments.js';

// -------- Add Hotspot Source Link --------

export async function addHotspotSourceLink(sqHotspot, scHotspot, client, options) {
  const { sonarqubeUrl, sonarqubeProjectKey } = options;
  if (!sonarqubeUrl || !sonarqubeProjectKey) return false;

  try {
    const text = buildHotspotSourceComment(sonarqubeUrl, sonarqubeProjectKey, sqHotspot.key);
    await client.addHotspotComment(scHotspot.key, text);
    return true;
  } catch (error) {
    logger.debug(`Failed to add source link comment to hotspot ${scHotspot.key}: ${error.message}`);
    return false;
  }
}
