import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Migrate project tags.
export async function migrateProjectTags(projectKey, tags, client) {
  if (!tags || tags.length === 0) return;
  logger.info(`Setting ${tags.length} tags on project ${projectKey}`);
  try {
    await client.setProjectTags(projectKey, tags);
  } catch (error) {
    logger.warn(`Failed to set project tags on ${projectKey}: ${error.message}`);
  }
}
