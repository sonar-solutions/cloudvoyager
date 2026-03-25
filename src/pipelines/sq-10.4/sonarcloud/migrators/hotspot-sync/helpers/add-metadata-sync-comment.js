import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Mark hotspot as metadata-synchronized via comment.
export async function addMetadataSyncComment(scHotspot, client, stats) {
  try {
    await client.addHotspotComment(scHotspot.key, '[Metadata Synchronized] This hotspot\'s metadata has been synced from SonarQube.');
    stats.metadataSyncCommented++;
  } catch (error) {
    logger.debug(`Failed to add metadata-synchronized comment to hotspot ${scHotspot.key}: ${error.message}`);
  }
}
