import logger from '../../../../../../shared/utils/logger.js';

// -------- Sync Issue Comments, Tags, and Source Link --------

export async function syncIssueCommentsAndTags(scIssue, sqIssue, client, stats, sqClient) {
  // Sync comments
  for (const comment of (sqIssue.comments || [])) {
    try {
      const text = `[Migrated from SonarQube] ${comment.login || 'unknown'} (${comment.createdAt || ''}): ${comment.markdown || comment.htmlText || ''}`;
      await client.addIssueComment(scIssue.key, text);
      stats.commented++;
    } catch (error) {
      logger.debug(`Failed to add comment to issue ${scIssue.key}: ${error.message}`);
    }
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
  } catch (error) {
    logger.debug(`Failed to set tags on issue ${scIssue.key}: ${error.message}`);
  }

  // Add source link comment
  if (sqClient?.baseURL && sqClient?.projectKey) {
    try {
      const sqUrl = `${sqClient.baseURL}/project/issues?id=${encodeURIComponent(sqClient.projectKey)}&issues=${encodeURIComponent(sqIssue.key)}&open=${encodeURIComponent(sqIssue.key)}`;
      await client.addIssueComment(scIssue.key, `[SonarQube Source] Original issue: ${sqUrl}`);
      stats.sourceLinked++;
    } catch (error) {
      logger.debug(`Failed to add source link comment to issue ${scIssue.key}: ${error.message}`);
    }
  }
}
