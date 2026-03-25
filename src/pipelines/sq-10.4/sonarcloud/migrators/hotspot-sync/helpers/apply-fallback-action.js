import logger from '../../../../../../shared/utils/logger.js';
import { applyHotspotAction } from './apply-hotspot-action.js';
import { getFallbackAction } from './get-fallback-action.js';

// -------- Main Logic --------

// Determine a single fallback action from the current SQ hotspot state and apply it.
export async function applyFallbackAction(client, scHotspot, sqHotspot) {
  const action = getFallbackAction(scHotspot, sqHotspot);
  if (!action) return false;

  try {
    // If we need to change resolution on an already-reviewed hotspot, reopen first
    if (action.needsReopen) await client.changeHotspotStatus(scHotspot.key, 'TO_REVIEW');
    await applyHotspotAction(client, scHotspot.key, action);
    return true;
  } catch (error) {
    logger.debug(`Failed to change hotspot ${scHotspot.key} status: ${error.message}`);
    return false;
  }
}
