import { mapHotspotResolution } from './map-hotspot-resolution.js';

// -------- Get Fallback Action --------

/**
 * Determine the fallback action for a hotspot based on current SQ/SC state.
 */
export function getFallbackAction(scHotspot, sqHotspot) {
  const sqStatus = sqHotspot.status;
  const scStatus = scHotspot.status;

  if (sqStatus === 'TO_REVIEW' && scStatus !== 'TO_REVIEW') {
    return { status: 'TO_REVIEW', resolution: null };
  }

  if (sqStatus !== 'TO_REVIEW') {
    const resolution = mapHotspotResolution(sqHotspot);
    if (!resolution) return null;
    if (scStatus !== 'TO_REVIEW') return { status: 'REVIEWED', resolution, needsReopen: true };
    return { status: 'REVIEWED', resolution };
  }

  return null;
}
