import logger from '../../../../../../shared/utils/logger.js';

// -------- Add Metadata Sync Comment --------

export async function addMetadataSyncComment(scHotspot, client) {
  try {
    await client.addHotspotComment(scHotspot.key, '[Metadata Synchronized] This hotspot\'s metadata has been synced from SonarQube.');
    return true;
  } catch (error) {
    logger.debug(`Failed to add metadata-synchronized comment to hotspot ${scHotspot.key}: ${error.message}`);
    return false;
  }
}
