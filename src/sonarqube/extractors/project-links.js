import logger from '../../utils/logger.js';

/**
 * Extract project links (external links configured on project)
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} [projectKey] - Project key (defaults to client's projectKey)
 * @returns {Promise<Array>} Project links
 */
export async function extractProjectLinks(client, projectKey = null) {
  const links = await client.getProjectLinks(projectKey);
  logger.info(`Found ${links.length} project links`);

  return links.map(link => ({
    id: link.id,
    name: link.name,
    type: link.type,
    url: link.url
  }));
}
