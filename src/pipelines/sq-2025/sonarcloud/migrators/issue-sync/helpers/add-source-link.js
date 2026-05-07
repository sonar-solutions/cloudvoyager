import logger from '../../../../../../shared/utils/logger.js';
import { resolveSourceBaseURL } from '../../../../../../shared/utils/source-link/resolve-source-base-url.js';
import { buildIssueSourceComment } from '../../../../../../shared/utils/source-link/build-source-comments.js';

// -------- Add Source Link --------

/** Add a comment linking back to the original SonarQube issue. */
export async function addSourceLink(sqIssue, scIssue, client, sqClient, stats) {
  if (!sqClient || !sqClient.baseURL || !sqClient.projectKey) return;

  try {
    const baseURL = await resolveSourceBaseURL(sqClient);
    const text = buildIssueSourceComment(baseURL, sqClient.projectKey, sqIssue.key);
    await client.addIssueComment(scIssue.key, text);
    stats.sourceLinked++;
  } catch (error) {
    logger.debug(`Failed to add source link comment to issue ${scIssue.key}: ${error.message}`);
  }
}
