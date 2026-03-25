import { mapHotspotResolution } from './map-hotspot-resolution.js';

// -------- Main Logic --------

// Determine the fallback action for a hotspot based on current SQ/SC state.
export function getFallbackAction(scHotspot, sqHotspot) {
  const sqStatus = sqHotspot.status;
  const scStatus = scHotspot.status;

  // SQ is TO_REVIEW, SC is REVIEWED -> reopen
  if (sqStatus === 'TO_REVIEW' && scStatus !== 'TO_REVIEW') {
    return { status: 'TO_REVIEW', resolution: null };
  }

  // SQ is not TO_REVIEW -> need to review with resolution
  if (sqStatus !== 'TO_REVIEW') {
    const resolution = mapHotspotResolution(sqHotspot);
    if (!resolution) return null;
    // SC is already REVIEWED but with different resolution -> reopen then re-review
    if (scStatus !== 'TO_REVIEW') return { status: 'REVIEWED', resolution, needsReopen: true };
    return { status: 'REVIEWED', resolution };
  }

  return null;
}
