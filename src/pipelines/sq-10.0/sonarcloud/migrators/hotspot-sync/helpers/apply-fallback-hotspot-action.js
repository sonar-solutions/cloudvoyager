// -------- Apply Fallback Hotspot Action --------

import logger from '../../../../../../shared/utils/logger.js';
import { applyHotspotAction } from './apply-hotspot-action.js';
import { getFallbackAction } from './get-fallback-action.js';

export async function applyFallbackHotspotAction(client, scHotspot, sqHotspot) {
  const action = getFallbackAction(scHotspot, sqHotspot);
  if (!action) return false;

  try {
    if (action.needsReopen) await client.changeHotspotStatus(scHotspot.key, 'TO_REVIEW');
    await applyHotspotAction(client, scHotspot.key, action);
    return true;
  } catch (error) {
    logger.debug(`Failed to change hotspot ${scHotspot.key} status: ${error.message}`);
    return false;
  }
}
