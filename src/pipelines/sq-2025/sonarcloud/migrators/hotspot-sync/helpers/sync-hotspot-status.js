import logger from '../../../../../../shared/utils/logger.js';
import { extractHotspotTransitionsFromChangelog } from './map-hotspot-changelog.js';
import { applyFallbackAction } from './hotspot-fallback-action.js';

// -------- Sync Hotspot Status --------

/** Sync hotspot status by replaying changelog or falling back to single transition. */
export async function syncHotspotStatus(scHotspot, sqHotspot, client) {
  if (scHotspot.status === sqHotspot.status && (scHotspot.resolution || null) === (sqHotspot.resolution || null)) return false;

  const changelog = sqHotspot.changelog;
  if (changelog && changelog.length > 0) {
    const transitions = extractHotspotTransitionsFromChangelog(changelog);
    if (transitions.length > 0) {
      let applied = false;
      for (const action of transitions) {
        try {
          await client.changeHotspotStatus(scHotspot.key, action.status, action.resolution || undefined);
          applied = true;
        } catch (error) {
          logger.debug(`Failed to apply hotspot transition on ${scHotspot.key}: ${error.message}`);
        }
      }
      return applied;
    }
  }

  return await applyFallbackAction(client, scHotspot, sqHotspot);
}
