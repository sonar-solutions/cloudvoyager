import { mapChangelogDiffToTransition } from './map-changelog-diff-to-transition.js';

// -------- Extract Ordered Status Transitions from Changelog --------

export function extractTransitionsFromChangelog(changelog) {
  const transitions = [];
  for (const entry of changelog) {
    const diffs = entry.diffs || [];
    if (!diffs.some(d => d.key === 'status')) continue;
    const transition = mapChangelogDiffToTransition(diffs);
    if (transition) transitions.push(transition);
  }
  return transitions;
}
