// -------- Normalize Hotspot Status --------

/**
 * Normalize hotspot status + resolution into a comparable string.
 */
export function normalizeHotspotStatus(status, resolution) {
  if (status === 'REVIEWED' && resolution) return `REVIEWED:${resolution}`;
  if (['SAFE', 'ACKNOWLEDGED', 'FIXED'].includes(status)) return `REVIEWED:${status}`;
  return status || 'TO_REVIEW';
}
