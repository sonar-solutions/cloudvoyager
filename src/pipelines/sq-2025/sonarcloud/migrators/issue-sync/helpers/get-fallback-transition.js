// -------- Get Fallback Transition --------

/**
 * Determine a single fallback transition from the current SQ status/resolution.
 * Used when no SQ client is available for changelog replay.
 */
export function getFallbackTransition(sqIssue) {
  if (sqIssue.resolution === 'FALSE-POSITIVE' || sqIssue.status === 'FALSE-POSITIVE') return 'falsepositive';
  if (sqIssue.resolution === 'WONTFIX' || sqIssue.status === 'WONTFIX') return 'wontfix';

  switch (sqIssue.status) {
    case 'CONFIRMED': return 'confirm';
    case 'RESOLVED':
    case 'CLOSED':
    case 'FIXED': return 'resolve';
    case 'ACCEPTED': return 'wontfix';
    case 'REOPENED': return 'reopen';
    default: return null;
  }
}
