import logger from '../../../../../../shared/utils/logger.js';
import { extractHotspotTransitionsFromChangelog } from './extract-hotspot-transitions.js';
import { mapHotspotResolution } from './map-hotspot-resolution.js';

// -------- Sync Hotspot Status via Changelog Replay --------

async function applyHotspotAction(client, hotspotKey, action) {
  await client.changeHotspotStatus(hotspotKey, action.status, action.resolution || undefined);
}

function getFallbackAction(scHotspot, sqHotspot) {
  const sqStatus = sqHotspot.status;
  const scStatus = scHotspot.status;
  if (sqStatus === 'TO_REVIEW' && scStatus !== 'TO_REVIEW') return { status: 'TO_REVIEW', resolution: null };
  if (sqStatus !== 'TO_REVIEW') {
    const resolution = mapHotspotResolution(sqHotspot);
    if (!resolution) return null;
    if (scStatus !== 'TO_REVIEW') return { status: 'REVIEWED', resolution, needsReopen: true };
    return { status: 'REVIEWED', resolution };
  }
  return null;
}

export async function syncHotspotStatus(scHotspot, sqHotspot, client) {
  if (scHotspot.status === sqHotspot.status && (scHotspot.resolution || null) === (sqHotspot.resolution || null)) return false;

  const changelog = sqHotspot.changelog;
  if (changelog?.length > 0) {
    const transitions = extractHotspotTransitionsFromChangelog(changelog);
    if (transitions.length > 0) {
      let applied = false;
      for (const action of transitions) {
        try { await applyHotspotAction(client, scHotspot.key, action); applied = true; } catch (e) { logger.debug(`Failed hotspot transition on ${scHotspot.key}: ${e.message}`); }
      }
      return applied;
    }
  }

  const action = getFallbackAction(scHotspot, sqHotspot);
  if (!action) return false;
  try {
    if (action.needsReopen) await client.changeHotspotStatus(scHotspot.key, 'TO_REVIEW');
    await applyHotspotAction(client, scHotspot.key, action);
    return true;
  } catch (e) { logger.debug(`Failed to change hotspot ${scHotspot.key} status: ${e.message}`); return false; }
}
