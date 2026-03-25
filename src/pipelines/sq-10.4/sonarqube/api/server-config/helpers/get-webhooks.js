import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch webhooks from SonarQube (project-scoped or server-level).
export async function getWebhooks(client, projectKey = null) {
  const scope = projectKey ? ' for project: ' + projectKey : ' (server-level)';
  logger.info(`Fetching webhooks${scope}`);
  const params = {};
  if (projectKey) params.project = projectKey;
  try {
    const response = await client.get('/api/webhooks/list', { params });
    return response.data.webhooks || [];
  } catch (error) {
    logger.warn(`Failed to get webhooks: ${error.message}`);
    return [];
  }
}
