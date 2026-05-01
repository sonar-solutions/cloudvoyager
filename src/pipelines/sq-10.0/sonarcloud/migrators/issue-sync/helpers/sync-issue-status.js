import logger from '../../../../../../shared/utils/logger.js';
import { getFallbackTransition } from './transition-mapping.js';

// -------- Sync Issue Status --------

/**
 * Sync the SC issue's status to match the current SQ issue status.
 * Applies a single transition derived from the SQ issue's current state.
 */
export async function syncIssueStatus(scIssue, sqIssue, client) {
  if (scIssue.status === sqIssue.status) return false;
  return applyFallbackTransition(scIssue, sqIssue, client);
}

async function applyFallbackTransition(scIssue, sqIssue, client) {
  const transition = getFallbackTransition(sqIssue);
  if (!transition) return false;
  try { await client.transitionIssue(scIssue.key, transition); return true; }
  catch (error) { logger.debug(`Failed to transition issue ${scIssue.key} to ${transition}: ${error.message}`); return false; }
}
