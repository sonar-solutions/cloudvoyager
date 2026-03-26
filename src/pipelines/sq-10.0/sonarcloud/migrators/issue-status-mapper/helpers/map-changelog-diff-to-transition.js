// -------- Map Changelog Diff To Transition --------

/**
 * Map a changelog diff entry (newStatus + newResolution) to a SonarCloud transition.
 * Returns null if no transition is needed.
 */
export function mapChangelogDiffToTransition(diffs) {
  const statusDiff = diffs.find(d => d.key === 'status');
  const resolutionDiff = diffs.find(d => d.key === 'resolution');
  const newStatus = statusDiff?.newValue;
  const newResolution = resolutionDiff?.newValue;

  if (!newStatus) return null;

  // Resolution-based transitions take priority.
  // Also handle SonarQube 10.4+ where WONTFIX/FALSE-POSITIVE can appear as a direct status value.
  if (newResolution === 'FALSE-POSITIVE' || newStatus === 'FALSE-POSITIVE') return 'falsepositive';
  if (newResolution === 'WONTFIX' || newStatus === 'WONTFIX') return 'wontfix';

  switch (newStatus) {
    case 'CONFIRMED': return 'confirm';
    case 'REOPENED': return 'reopen';
    case 'OPEN': return 'unconfirm';
    case 'RESOLVED': return 'resolve';
    case 'CLOSED': return 'resolve';
    case 'ACCEPTED': return 'wontfix';
    default: return null;
  }
}
