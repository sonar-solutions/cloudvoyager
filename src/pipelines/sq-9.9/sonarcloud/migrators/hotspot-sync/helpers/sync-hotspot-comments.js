import logger from '../../../../../../shared/utils/logger.js';

// -------- Sync Hotspot Comments, Metadata Marker, and Source Link --------

export async function syncHotspotComments(scHotspot, sqHotspot, client, stats, options) {
  for (const comment of (sqHotspot.comments || [])) {
    try {
      const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
      await client.addHotspotComment(scHotspot.key, text);
      stats.commented++;
    } catch (e) { logger.debug(`Failed to add comment to hotspot ${scHotspot.key}: ${e.message}`); }
  }

  try {
    await client.addHotspotComment(scHotspot.key, '[Metadata Synchronized] This hotspot\'s metadata has been synced from SonarQube.');
    stats.metadataSyncCommented++;
  } catch (e) { logger.debug(`Failed to add metadata comment to hotspot ${scHotspot.key}: ${e.message}`); }

  if (options.sonarqubeUrl && options.sonarqubeProjectKey) {
    try {
      const sqUrl = `${options.sonarqubeUrl}/security_hotspots?id=${encodeURIComponent(options.sonarqubeProjectKey)}&hotspots=${encodeURIComponent(sqHotspot.key)}`;
      await client.addHotspotComment(scHotspot.key, `[SonarQube Source] Original hotspot: ${sqUrl}`);
      stats.sourceLinked++;
    } catch (e) { logger.debug(`Failed to add source link to hotspot ${scHotspot.key}: ${e.message}`); }
  }
}
