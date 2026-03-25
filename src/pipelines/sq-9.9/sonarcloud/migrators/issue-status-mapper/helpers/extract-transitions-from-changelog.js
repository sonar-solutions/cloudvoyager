import { mapChangelogDiffToTransition } from './map-changelog-diff-to-transition.js';

// -------- Extract Transitions from Issue Changelog --------

export function extractTransitionsFromChangelog(changelog) {
  const transitions = [];
  for (const entry of changelog) {
    const diffs = entry.diffs || [];
    const hasStatusChange = diffs.some(d => d.key === 'status');
    if (!hasStatusChange) continue;

    const transition = mapChangelogDiffToTransition(diffs);
    if (transition) transitions.push(transition);
  }
  return transitions;
}
