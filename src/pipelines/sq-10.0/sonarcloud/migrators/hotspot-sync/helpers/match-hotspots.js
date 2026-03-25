import logger from '../../../../../../shared/utils/logger.js';
import { buildHotspotMatchKey } from './build-hotspot-match-key.js';

// -------- Match Hotspots --------

/**
 * Build SC hotspot lookup map and match against SQ hotspots.
 */
export function matchHotspots(scHotspots, sqHotspots) {
  const scHotspotMap = new Map();
  for (const hotspot of scHotspots) {
    const key = buildHotspotMatchKey(hotspot);
    if (!key) continue;
    if (!scHotspotMap.has(key)) scHotspotMap.set(key, []);
    scHotspotMap.get(key).push(hotspot);
  }

  const matchedPairs = [];
  for (const sqHotspot of sqHotspots) {
    const matchKey = buildHotspotMatchKey(sqHotspot);
    if (!matchKey) continue;
    const candidates = scHotspotMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;
    matchedPairs.push({ sqHotspot, scHotspot: candidates.shift() });
  }

  logger.info(`Matched ${matchedPairs.length} hotspots`);
  return matchedPairs;
}
