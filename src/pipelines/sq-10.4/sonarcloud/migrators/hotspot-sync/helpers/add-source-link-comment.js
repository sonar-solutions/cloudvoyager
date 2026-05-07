import logger from '../../../../../../shared/utils/logger.js';
import { buildHotspotSourceComment } from '../../../../../../shared/utils/source-link/build-source-comments.js';

// -------- Main Logic --------

// Add comment with link back to original SonarQube hotspot.
export async function addSourceLinkComment(sqHotspot, scHotspot, client, stats, options) {
  const { sonarqubeUrl, sonarqubeProjectKey } = options;
  if (!sonarqubeUrl || !sonarqubeProjectKey) return;

  try {
    const text = buildHotspotSourceComment(sonarqubeUrl, sonarqubeProjectKey, sqHotspot.key);
    await client.addHotspotComment(scHotspot.key, text);
    stats.sourceLinked++;
  } catch (error) {
    logger.debug(`Failed to add source link comment to hotspot ${scHotspot.key}: ${error.message}`);
  }
}
