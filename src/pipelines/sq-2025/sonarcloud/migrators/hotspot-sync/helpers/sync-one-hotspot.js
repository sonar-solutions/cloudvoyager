import logger from '../../../../../../shared/utils/logger.js';
import { buildHotspotSourceComment } from '../../../../../../shared/utils/source-link/build-source-comments.js';
import { syncHotspotStatus } from './sync-hotspot-status.js';

// -------- Sync One Hotspot --------

/** Sync a single matched hotspot pair (status, comments, source link). */
export async function syncOneHotspot({ sqHotspot, scHotspot }, client, options, stats) {
  try {
    const changed = await syncHotspotStatus(scHotspot, sqHotspot, client);
    if (changed) stats.statusChanged++;

    for (const comment of (sqHotspot.comments || [])) {
      try {
        const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
        await client.addHotspotComment(scHotspot.key, text);
        stats.commented++;
      } catch (error) { logger.debug(`Failed to add comment to hotspot ${scHotspot.key}: ${error.message}`); }
    }

    try {
      await client.addHotspotComment(scHotspot.key, '[Metadata Synchronized] This hotspot\'s metadata has been synced from SonarQube.');
      stats.metadataSyncCommented++;
    } catch (error) { logger.debug(`Failed to add metadata comment to hotspot ${scHotspot.key}: ${error.message}`); }

    if (options.sonarqubeUrl && options.sonarqubeProjectKey) {
      try {
        const text = buildHotspotSourceComment(options.sonarqubeUrl, options.sonarqubeProjectKey, sqHotspot.key);
        await client.addHotspotComment(scHotspot.key, text);
        stats.sourceLinked++;
      } catch (error) { logger.debug(`Failed to add source link to hotspot ${scHotspot.key}: ${error.message}`); }
    }
  } catch (error) {
    stats.failed++;
    logger.debug(`Failed to sync hotspot ${sqHotspot.key}: ${error.message}`);
  }
}
