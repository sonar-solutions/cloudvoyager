import logger from '../../../../../../shared/utils/logger.js';

// -------- Sync Issue Comments --------

export async function syncIssueComments(sqIssue, scIssue, client, stats) {
  const comments = sqIssue.comments || [];
  for (const comment of comments) {
    try {
      const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
      await client.addIssueComment(scIssue.key, text);
      stats.commented++;
    } catch (error) {
      logger.debug(`Failed to add comment to issue ${scIssue.key}: ${error.message}`);
    }
  }
}
