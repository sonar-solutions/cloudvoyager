import logger from '../../../../../../shared/utils/logger.js';

// -------- Sync Issue Tags --------

export async function syncIssueTags(sqIssue, scIssue, client, stats) {
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
}
