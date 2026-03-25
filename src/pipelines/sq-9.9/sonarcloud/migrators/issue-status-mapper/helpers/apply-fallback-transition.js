import logger from '../../../../../../shared/utils/logger.js';
import { getFallbackTransition } from './get-fallback-transition.js';

// -------- Apply Fallback Transition --------

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
