import { mapChangelogDiffToTransition } from './map-changelog-diff-to-transition.js';

// -------- Extract Transitions from Changelog --------

/**
 * Extract the ordered list of status transitions from a SonarQube issue changelog.
 * Only includes entries that contain a status change diff.
 */
export function extractTransitionsFromChangelog(changelog) {
  const transitions = [];

  for (const entry of changelog) {
    const diffs = entry.diffs || [];
    const hasStatusChange = diffs.some(d => d.key === 'status');
    if (!hasStatusChange) continue;

    const transition = mapChangelogDiffToTransition(diffs);
    if (transition) {
      transitions.push(transition);
    }
  }

  return transitions;
}
