import logger from '../../../../../../shared/utils/logger.js';

// -------- Sync Hotspot Comments --------

export async function syncHotspotComments(sqHotspot, scHotspot, client) {
  let count = 0;
  for (const comment of (sqHotspot.comments || [])) {
    try {
      const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
      await client.addHotspotComment(scHotspot.key, text);
      count++;
    } catch (error) {
      logger.debug(`Failed to add comment to hotspot ${scHotspot.key}: ${error.message}`);
    }
  }
  return count;
}
