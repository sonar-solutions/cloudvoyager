import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Sync all comments from a SQ hotspot to the matched SC hotspot.
export async function syncHotspotComments(sqHotspot, scHotspot, client, stats) {
  for (const comment of (sqHotspot.comments || [])) {
    try {
      const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
      await client.addHotspotComment(scHotspot.key, text);
      stats.commented++;
    } catch (error) {
      logger.debug(`Failed to add comment to hotspot ${scHotspot.key}: ${error.message}`);
    }
  }
}
