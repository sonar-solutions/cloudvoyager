import logger from '../../../../../../shared/utils/logger.js';

// -------- Get Project Settings --------

export async function getProjectSettings(client, projectKey) {
  logger.info(`Fetching project settings for: ${projectKey}`);
  const response = await client.get('/api/settings/values', { params: { component: projectKey } });
  return response.data.settings || [];
}

export async function getServerSettings(client) {
  logger.info('Fetching server-level settings');
  const response = await client.get('/api/settings/values');
  return response.data.settings || [];
}
