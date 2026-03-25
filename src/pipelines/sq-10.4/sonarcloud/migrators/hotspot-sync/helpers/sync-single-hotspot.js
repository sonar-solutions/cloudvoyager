import logger from '../../../../../../shared/utils/logger.js';
import { syncHotspotStatus } from './sync-hotspot-status.js';
import { syncHotspotComments } from './sync-hotspot-comments.js';
import { addMetadataSyncComment } from './add-metadata-sync-comment.js';
import { addSourceLinkComment } from './add-source-link-comment.js';

// -------- Main Logic --------

// Sync all aspects of a single matched hotspot pair.
export async function syncSingleHotspot({ sqHotspot, scHotspot }, client, stats, options) {
  try {
    const changed = await syncHotspotStatus(scHotspot, sqHotspot, client);
    if (changed) stats.statusChanged++;

    await syncHotspotComments(sqHotspot, scHotspot, client, stats);
    await addMetadataSyncComment(scHotspot, client, stats);
    await addSourceLinkComment(sqHotspot, scHotspot, client, stats, options);
  } catch (error) {
    stats.failed++;
    logger.debug(`Failed to sync hotspot ${sqHotspot.key}: ${error.message}`);
  }
}
