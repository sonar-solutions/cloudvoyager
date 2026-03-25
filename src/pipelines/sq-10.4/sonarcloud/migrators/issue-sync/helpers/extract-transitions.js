import { mapChangelogDiffToTransition } from './map-changelog-diff.js';

// -------- Main Logic --------

/**
 * Extract the ordered list of status transitions from a SonarQube issue changelog.
 */
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
