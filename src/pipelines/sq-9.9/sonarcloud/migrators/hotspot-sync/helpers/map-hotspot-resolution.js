// -------- Map SQ Hotspot Status/Resolution to SC Resolution --------

export function mapHotspotResolution(sqHotspot) {
  if (sqHotspot.resolution === 'ACKNOWLEDGED') return 'ACKNOWLEDGED';
  if (sqHotspot.resolution === 'FIXED') return 'FIXED';
  if (sqHotspot.resolution === 'SAFE' || sqHotspot.status === 'REVIEWED') return 'SAFE';
  return null;
}
