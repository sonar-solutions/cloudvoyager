import logger from '../../utils/logger.js';

/**
 * Extract project tags
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<Array<string>>} Project tags
 */
export async function extractProjectTags(client) {
  const tags = await client.getProjectTags();
  logger.info(`Found ${tags.length} project tags`);
  return tags;
}
