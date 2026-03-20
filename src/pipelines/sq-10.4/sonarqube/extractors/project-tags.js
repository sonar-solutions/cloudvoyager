import logger from '../../../../shared/utils/logger.js';

/**
 * Extract project-specific tags (not server-wide).
 * Uses /api/projects/search to get the project's own tags, since
 * /api/project_tags/search returns ALL tags across the entire server.
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<Array<string>>} Project tags
 */
export async function extractProjectTags(client) {
  try {
    const project = await client.getProject();
    const tags = project.tags || [];
    logger.info(`Found ${tags.length} project tags`);
    return tags;
  } catch (error) {
    logger.warn(`Failed to get project tags: ${error.message}`);
    return [];
  }
}
