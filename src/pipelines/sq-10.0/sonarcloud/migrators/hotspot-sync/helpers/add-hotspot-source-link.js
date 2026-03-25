import logger from '../../../../../../shared/utils/logger.js';

// -------- Add Hotspot Source Link --------

export async function addHotspotSourceLink(sqHotspot, scHotspot, client, options) {
  const { sonarqubeUrl, sonarqubeProjectKey } = options;
  if (!sonarqubeUrl || !sonarqubeProjectKey) return false;

  try {
    const sqUrl = `${sonarqubeUrl}/security_hotspots?id=${encodeURIComponent(sonarqubeProjectKey)}&hotspots=${encodeURIComponent(sqHotspot.key)}`;
    await client.addHotspotComment(scHotspot.key, `[SonarQube Source] Original hotspot: ${sqUrl}`);
    return true;
  } catch (error) {
    logger.debug(`Failed to add source link comment to hotspot ${scHotspot.key}: ${error.message}`);
    return false;
  }
}
