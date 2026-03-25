import logger from '../../../../../../shared/utils/logger.js';
import { extractHotspotTransitionsFromChangelog } from './extract-transitions.js';
import { applyHotspotAction } from './apply-hotspot-action.js';
import { applyFallbackAction } from './apply-fallback-action.js';

// -------- Main Logic --------

// Sync hotspot status by replaying the full changelog transition sequence.
export async function syncHotspotStatus(scHotspot, sqHotspot, client) {
  // Skip if statuses and resolutions already match
  if (scHotspot.status === sqHotspot.status && (scHotspot.resolution || null) === (sqHotspot.resolution || null)) {
    return false;
  }

  // Try changelog replay if changelog is available
  const changelog = sqHotspot.changelog;
  if (changelog?.length > 0) {
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

  // Fallback: single transition based on current SQ state
  return await applyFallbackAction(client, scHotspot, sqHotspot);
}
