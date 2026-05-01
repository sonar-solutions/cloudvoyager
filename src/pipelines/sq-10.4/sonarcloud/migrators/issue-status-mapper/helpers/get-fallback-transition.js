// -------- Main Logic --------

// Determine a single fallback transition from the current SQ status/resolution.
export function getFallbackTransition(sqIssue) {
  // Check both resolution and status to handle SonarQube 10.4+
  if (sqIssue.resolution === 'FALSE-POSITIVE' || sqIssue.status === 'FALSE-POSITIVE') return 'falsepositive';
  if (sqIssue.resolution === 'WONTFIX' || sqIssue.status === 'WONTFIX') return 'wontfix';

  switch (sqIssue.status) {
    case 'CONFIRMED': return 'confirm';
    case 'RESOLVED':
    case 'CLOSED':
    case 'FIXED': return 'resolve';
    // ACCEPTED in SQ 10.4+ maps to 'wontfix' in SonarCloud
    case 'ACCEPTED': return 'wontfix';
    case 'REOPENED': return 'reopen';
    default: return null;
  }
}
