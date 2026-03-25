// -------- Match Hotspots --------

import { buildHotspotMatchKey } from './build-match-key.js';

/** Match SQ hotspots to SC hotspots using rule + file + line keys. */
export function matchHotspots(sqHotspots, scHotspots) {
  const scMap = new Map();
  for (const h of scHotspots) {
    const key = buildHotspotMatchKey(h);
    if (key) {
      if (!scMap.has(key)) scMap.set(key, []);
      scMap.get(key).push(h);
    }
  }

  const matchedPairs = [];
  const matchedSqKeys = new Set();
  for (const sqH of sqHotspots) {
    const key = buildHotspotMatchKey(sqH);
    if (!key) continue;
    const candidates = scMap.get(key);
    if (!candidates || candidates.length === 0) continue;
    matchedPairs.push({ sqHotspot: sqH, scHotspot: candidates.shift() });
    matchedSqKeys.add(sqH.key);
  }

  return { matchedPairs, matchedSqKeys, scHotspotMap: scMap };
}
