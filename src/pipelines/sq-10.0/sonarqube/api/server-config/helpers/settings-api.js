import logger from '../../../../../../shared/utils/logger.js';

// -------- Settings API --------

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

export async function getProjectTags(client, projectKey = null) {
  const label = projectKey ? `for project: ${projectKey}` : '(server-wide)';
  logger.info(`Fetching project tags ${label}`);
  const params = { ps: 100 };
  if (projectKey) params.project = projectKey;
  const response = await client.get('/api/project_tags/search', { params });
  return response.data.tags || [];
}

export async function getProjectLinks(client, projectKey) {
  logger.info(`Fetching project links for: ${projectKey}`);
  const response = await client.get('/api/project_links/search', { params: { projectKey } });
  return response.data.links || [];
}
