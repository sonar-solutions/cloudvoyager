import { applyFallbackTransition } from './apply-fallback-transition.js';

// -------- Sync Issue Status --------

/**
 * Sync the SC issue's status to match the current SQ issue status.
 * Applies a single transition derived from the SQ issue's current state.
 */
export async function syncIssueStatus(scIssue, sqIssue, client) {
  if (scIssue.status === sqIssue.status) return false;
  return applyFallbackTransition(scIssue, sqIssue, client);
}
