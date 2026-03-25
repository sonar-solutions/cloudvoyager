import logger from '../../../../shared/utils/logger.js';

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
  // Also handle SonarQube 10.4+ where WONTFIX/FALSE-POSITIVE can appear as a
  // direct status value (newStatus) rather than only as a resolution.
  if (newResolution === 'FALSE-POSITIVE' || newStatus === 'FALSE-POSITIVE') return 'falsepositive';
  if (newResolution === 'WONTFIX' || newStatus === 'WONTFIX') return 'wontfix';

  switch (newStatus) {
    case 'CONFIRMED': return 'confirm';
    case 'REOPENED': return 'reopen';
    case 'OPEN': return 'unconfirm';
    case 'RESOLVED': return 'resolve';
    case 'CLOSED': return 'resolve';
    // ACCEPTED in SQ 10.4+ maps to 'wontfix' in SonarCloud (SC does not have an 'accept' transition)
    case 'ACCEPTED': return 'wontfix';
    default: return null;
  }
}

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

/**
 * Determine a single fallback transition from the current SQ status/resolution.
 * Used when no SQ client is available for changelog replay.
 */
export function getFallbackTransition(sqIssue) {
  // Check both resolution and status to handle SonarQube 10.4+ where
  // WONTFIX/FALSE-POSITIVE may appear as a direct status value.
  if (sqIssue.resolution === 'FALSE-POSITIVE' || sqIssue.status === 'FALSE-POSITIVE') return 'falsepositive';
  if (sqIssue.resolution === 'WONTFIX' || sqIssue.status === 'WONTFIX') return 'wontfix';

  switch (sqIssue.status) {
    case 'CONFIRMED': return 'confirm';
    case 'RESOLVED':
    case 'CLOSED': return 'resolve';
    // ACCEPTED in SQ 10.4+ maps to 'wontfix' in SonarCloud (SC does not have an 'accept' transition)
    case 'ACCEPTED': return 'wontfix';
    case 'REOPENED': return 'reopen';
    default: return null;
  }
}

/**
 * Apply a single transition based on the current SQ issue state (legacy behavior).
 */
export async function applyFallbackTransition(scIssue, sqIssue, client) {
  const transition = getFallbackTransition(sqIssue);
  if (!transition) return false;

  try {
    await client.transitionIssue(scIssue.key, transition);
    return true;
  } catch (error) {
    logger.debug(`Failed to transition issue ${scIssue.key} to ${transition}: ${error.message}`);
    return false;
  }
}
