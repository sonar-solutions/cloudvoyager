// -------- Sync Hotspot Status --------

import logger from '../../../../../../shared/utils/logger.js';
import { extractHotspotTransitionsFromChangelog } from './hotspot-transition-mapping.js';
import { applyHotspotAction } from './apply-hotspot-action.js';
import { applyFallbackHotspotAction } from './apply-fallback-hotspot-action.js';

/**
 * Sync hotspot status by replaying the full changelog transition sequence.
 * Falls back to a single transition when no changelog is available.
 */
export async function syncHotspotStatus(scHotspot, sqHotspot, client) {
  if (scHotspot.status === sqHotspot.status && (scHotspot.resolution || null) === (sqHotspot.resolution || null)) {
    return false;
  }

  const changelog = sqHotspot.changelog;
  if (changelog && changelog.length > 0) {
    const transitions = extractHotspotTransitionsFromChangelog(changelog);
    if (transitions.length > 0) {
      let applied = false;
      for (const action of transitions) {
        try {
          await applyHotspotAction(client, scHotspot.key, action);
          applied = true;
        } catch (error) {
          logger.debug(`Failed to apply hotspot transition ${JSON.stringify(action)} on ${scHotspot.key}: ${error.message}`);
        }
      }
      return applied;
    }
  }

  return await applyFallbackHotspotAction(client, scHotspot, sqHotspot);
}
