// -------- Map Hotspot Resolution --------

/**
 * Map SonarQube hotspot status/resolution to SonarCloud resolution.
 */
export function mapHotspotResolution(sqHotspot) {
  if (sqHotspot.resolution === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
  if (sqHotspot.resolution === 'FIXED') return 'FIXED';
  if (sqHotspot.resolution === 'SAFE' || sqHotspot.status === 'REVIEWED') return 'SAFE';
  return null;
}
