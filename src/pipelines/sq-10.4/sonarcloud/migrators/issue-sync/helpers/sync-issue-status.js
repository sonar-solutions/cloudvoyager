import { extractTransitionsFromChangelog } from './extract-transitions.js';
import { getFallbackTransition } from './get-fallback-transition.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Sync issue status by replaying the full changelog transition sequence.
 */
export async function syncIssueStatus(scIssue, sqIssue, client, sqClient, preloadedChangelog) {
  if (scIssue.status === sqIssue.status) return false;

  if (sqClient) {
    try {
      const changelog = preloadedChangelog ?? await sqClient.getIssueChangelog(sqIssue.key);
      const transitions = extractTransitionsFromChangelog(changelog);
      if (transitions.length === 0) return await applyFallbackTransition(scIssue, sqIssue, client);

      let applied = false;
      for (const transition of transitions) {
        try { await client.transitionIssue(scIssue.key, transition); applied = true; }
        catch (e) { logger.debug(`Failed to apply transition '${transition}' on issue ${scIssue.key}: ${e.message}`); }
      }
      return applied;
    } catch (error) {
      logger.debug(`Failed to fetch changelog for issue ${sqIssue.key}, falling back: ${error.message}`);
      return await applyFallbackTransition(scIssue, sqIssue, client);
    }
  }

  return await applyFallbackTransition(scIssue, sqIssue, client);
}

// -------- Helper Functions --------

async function applyFallbackTransition(scIssue, sqIssue, client) {
  const transition = getFallbackTransition(sqIssue);
  if (!transition) return false;
  try { await client.transitionIssue(scIssue.key, transition); return true; }
  catch (e) { logger.debug(`Failed to transition issue ${scIssue.key} to ${transition}: ${e.message}`); return false; }
}
