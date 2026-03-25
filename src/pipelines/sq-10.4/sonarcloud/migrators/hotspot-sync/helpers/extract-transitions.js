import { mapHotspotChangelogDiffToAction } from './map-changelog-diff.js';

// -------- Main Logic --------

// Extract the ordered list of status transitions from a SonarQube hotspot changelog.
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
