import logger from '../../../../../../shared/utils/logger.js';
import { syncHotspotStatus } from './sync-hotspot-status.js';
import { syncHotspotComments } from './sync-hotspot-comments.js';
import { addHotspotSourceLink } from './add-hotspot-source-link.js';
import { addMetadataSyncComment } from './add-metadata-sync-comment.js';

// -------- Sync Single Hotspot --------

export async function syncSingleHotspot(sqHotspot, scHotspot, client, options, stats) {
  try {
    const changed = await syncHotspotStatus(scHotspot, sqHotspot, client);
    if (changed) stats.statusChanged++;

    stats.commented += await syncHotspotComments(sqHotspot, scHotspot, client);
    if (await addMetadataSyncComment(scHotspot, client)) stats.metadataSyncCommented++;
    if (await addHotspotSourceLink(sqHotspot, scHotspot, client, options)) stats.sourceLinked++;
  } catch (error) {
    stats.failed++;
    logger.debug(`Failed to sync hotspot ${sqHotspot.key}: ${error.message}`);
  }
}
