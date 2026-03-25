import { mapHotspotChangelogDiffToAction } from './map-hotspot-changelog-diff.js';

// -------- Extract Ordered Hotspot Transitions from Changelog --------

export function extractHotspotTransitionsFromChangelog(changelog) {
  const transitions = [];
  for (const entry of changelog) {
    const diffs = entry.diffs || [];
    if (!diffs.some(d => d.key === 'status')) continue;
    const action = mapHotspotChangelogDiffToAction(diffs);
    if (action) transitions.push(action);
  }
  return transitions;
}
