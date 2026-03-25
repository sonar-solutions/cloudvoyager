import logger from '../../../../../../shared/utils/logger.js';

// -------- Hotspot Fallback Action --------

/** Apply a fallback action based on current SQ/SC hotspot state. */
export async function applyFallbackAction(client, scHotspot, sqHotspot) {
  const action = getFallbackAction(scHotspot, sqHotspot);
  if (!action) return false;
  try {
    if (action.needsReopen) await client.changeHotspotStatus(scHotspot.key, 'TO_REVIEW');
    await client.changeHotspotStatus(scHotspot.key, action.status, action.resolution || undefined);
    return true;
  } catch (error) {
    logger.debug(`Failed to change hotspot ${scHotspot.key} status: ${error.message}`);
    return false;
  }
}

function getFallbackAction(scHotspot, sqHotspot) {
  if (sqHotspot.status === 'TO_REVIEW' && scHotspot.status !== 'TO_REVIEW') return { status: 'TO_REVIEW', resolution: null };
  if (sqHotspot.status !== 'TO_REVIEW') {
    const resolution = mapHotspotResolution(sqHotspot);
    if (!resolution) return null;
    if (scHotspot.status !== 'TO_REVIEW') return { status: 'REVIEWED', resolution, needsReopen: true };
    return { status: 'REVIEWED', resolution };
  }
  return null;
}

function mapHotspotResolution(sqHotspot) {
  if (sqHotspot.resolution === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
  if (sqHotspot.resolution === 'FIXED') return 'FIXED';
  if (sqHotspot.resolution === 'SAFE' || sqHotspot.status === 'REVIEWED') return 'SAFE';
  return null;
}
