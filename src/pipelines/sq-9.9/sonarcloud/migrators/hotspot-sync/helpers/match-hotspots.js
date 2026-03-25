import { buildHotspotMatchKey } from './build-hotspot-match-key.js';

// -------- Build Match Map and Pre-Match SQ <-> SC Hotspots --------

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
    const key = buildHotspotMatchKey(sqHs);
    if (!key) continue;
    const candidates = scMap.get(key);
    if (!candidates?.length) continue;
    matchedPairs.push({ sqHotspot: sqHs, scHotspot: candidates.shift() });
  }
  return matchedPairs;
}
