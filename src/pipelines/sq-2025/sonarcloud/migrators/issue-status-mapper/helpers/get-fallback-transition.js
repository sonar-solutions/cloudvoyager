// -------- Get Fallback Transition --------

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
    case 'ACCEPTED': return 'wontfix';
    case 'REOPENED': return 'reopen';
    default: return null;
  }
}
