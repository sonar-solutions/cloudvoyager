import logger from '../../../../../../shared/utils/logger.js';
import { resolveSourceBaseURL } from '../../../../../../shared/utils/source-link/resolve-source-base-url.js';
import { buildIssueSourceComment } from '../../../../../../shared/utils/source-link/build-source-comments.js';

// -------- Main Logic --------

/**
 * Sync comments, tags, and source link for a single issue.
 */
export async function syncIssueMetadata(sqIssue, scIssue, client, sqClient, stats) {
  // Sync comments
  for (const comment of (sqIssue.comments || [])) {
    try {
      const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
      await client.addIssueComment(scIssue.key, text);
      stats.commented++;
    } catch (e) { logger.debug(`Failed to add comment to issue ${scIssue.key}: ${e.message}`); }
  }

  // Sync tags + metadata-synchronized marker
  try {
    const sqTags = sqIssue.tags || [];
    const baseTags = sqTags.length > 0 ? sqTags : (scIssue.tags || []);
    if (!baseTags.includes('metadata-synchronized')) {
      const updatedTags = [...new Set([...baseTags, 'metadata-synchronized'])];
      await client.setIssueTags(scIssue.key, updatedTags);
      if (sqTags.length > 0) stats.tagged++;
      stats.metadataSyncTagged++;
    } else if (sqTags.length > 0) {
      await client.setIssueTags(scIssue.key, sqTags);
      stats.tagged++;
    }
  } catch (e) { logger.debug(`Failed to set tags on issue ${scIssue.key}: ${e.message}`); }

  // Add source link comment
  if (sqClient?.baseURL && sqClient?.projectKey) {
    try {
      const baseURL = await resolveSourceBaseURL(sqClient);
      const text = buildIssueSourceComment(baseURL, sqClient.projectKey, sqIssue.key);
      await client.addIssueComment(scIssue.key, text);
      stats.sourceLinked++;
    } catch (e) { logger.debug(`Failed to add source link comment to issue ${scIssue.key}: ${e.message}`); }
  }
}
