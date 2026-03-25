import { mapChangelogDiffToTransition } from './map-changelog-diff-to-transition.js';

// -------- Main Logic --------

// Extract the ordered list of status transitions from a SonarQube issue changelog.
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
