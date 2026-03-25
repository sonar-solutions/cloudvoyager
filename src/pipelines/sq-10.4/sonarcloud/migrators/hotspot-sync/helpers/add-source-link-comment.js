import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Add comment with link back to original SonarQube hotspot.
export async function addSourceLinkComment(sqHotspot, scHotspot, client, stats, options) {
  const { sonarqubeUrl, sonarqubeProjectKey } = options;
  if (!sonarqubeUrl || !sonarqubeProjectKey) return;

  try {
    const sqUrl = `${sonarqubeUrl}/security_hotspots?id=${encodeURIComponent(sonarqubeProjectKey)}&hotspots=${encodeURIComponent(sqHotspot.key)}`;
    await client.addHotspotComment(scHotspot.key, `[SonarQube Source] Original hotspot: ${sqUrl}`);
    stats.sourceLinked++;
  } catch (error) {
    logger.debug(`Failed to add source link comment to hotspot ${scHotspot.key}: ${error.message}`);
  }
}
