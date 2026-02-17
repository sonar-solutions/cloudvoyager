import logger from '../../utils/logger.js';

/**
 * Extract webhooks (server-level and project-level)
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} [projectKey] - Project key for project-level webhooks
 * @returns {Promise<Array>} Webhooks
 */
export async function extractWebhooks(client, projectKey = null) {
  const webhooks = await client.getWebhooks(projectKey);
  logger.info(`Found ${webhooks.length} webhooks${projectKey ? ` for project ${projectKey}` : ' (server-level)'}`);

  return webhooks.map(w => ({
    key: w.key,
    name: w.name,
    url: w.url,
    hasSecret: w.hasSecret || false,
    latestDelivery: w.latestDelivery || null
  }));
}
