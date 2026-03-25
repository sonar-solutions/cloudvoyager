import logger from '../../../../../../shared/utils/logger.js';
import { buildHotspotMatchKey } from './build-hotspot-match-key.js';

// -------- Match Hotspots --------

/** Build a lookup map and match SQ hotspots to SC hotspots by rule + file + line. */
export function matchHotspots(sqHotspots, scHotspots) {
  const scMap = new Map();
  for (const hs of scHotspots) {
    const key = buildHotspotMatchKey(hs);
    if (key) {
      if (!scMap.has(key)) scMap.set(key, []);
      scMap.get(key).push(hs);
    }
  }

  const matchedPairs = [];
  for (const sqHs of sqHotspots) {
    const matchKey = buildHotspotMatchKey(sqHs);
    if (!matchKey) continue;
    const candidates = scMap.get(matchKey);
    if (!candidates || candidates.length === 0) continue;
    matchedPairs.push({ sqHotspot: sqHs, scHotspot: candidates.shift() });
  }

  logger.info(`Matched ${matchedPairs.length} hotspots`);
  return matchedPairs;
}
