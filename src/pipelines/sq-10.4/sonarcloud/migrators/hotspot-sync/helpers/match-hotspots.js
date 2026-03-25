import { buildHotspotMatchKey } from './build-hotspot-match-key.js';

// -------- Main Logic --------

// Match SQ hotspots to SC hotspots by rule + file + line.
export function matchHotspots(sqHotspots, scHotspots) {
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
    if (!candidates?.length) continue;
    matchedPairs.push({ sqHotspot, scHotspot: candidates.shift() });
  }

  return matchedPairs;
}
