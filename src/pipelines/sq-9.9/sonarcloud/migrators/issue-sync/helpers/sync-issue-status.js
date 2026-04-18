import logger from '../../../../../../shared/utils/logger.js';
import { extractTransitionsFromChangelog } from './extract-transitions-from-changelog.js';
import { applyFallbackTransition } from './apply-fallback-transition.js';

// -------- Sync Issue Status via Changelog Replay --------

export async function syncIssueStatus(scIssue, sqIssue, client, sqClient, preloadedChangelog) {
  if (scIssue.status === sqIssue.status) return false;

  if (sqClient) {
    try {
      const changelog = preloadedChangelog ?? await sqClient.getIssueChangelog(sqIssue.key);
      const transitions = extractTransitionsFromChangelog(changelog);
      if (transitions.length === 0) return applyFallbackTransition(scIssue, sqIssue, client);

      let applied = false;
      for (const transition of transitions) {
        try {
          await client.transitionIssue(scIssue.key, transition);
          applied = true;
        } catch (error) {
          logger.debug(`Failed to apply transition '${transition}' on issue ${scIssue.key}: ${error.message}`);
        }
      }
      return applied;
    } catch (error) {
      logger.debug(`Failed to fetch changelog for issue ${sqIssue.key}, falling back: ${error.message}`);
      return applyFallbackTransition(scIssue, sqIssue, client);
    }
  }

  return applyFallbackTransition(scIssue, sqIssue, client);
}
