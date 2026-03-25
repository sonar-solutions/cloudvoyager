import logger from '../../../../../../shared/utils/logger.js';

// -------- System Info, ALM Settings, Plugins, and Webhooks --------

export async function getAlmSettings(client) {
  logger.info('Fetching ALM/DevOps settings');
  try {
    const response = await client.get('/api/alm_settings/list_definitions');
    return response.data;
  } catch (error) { logger.warn(`Failed to get ALM settings: ${error.message}`); return {}; }
}

export async function getProjectBinding(client, projectKey) {
  logger.debug(`Fetching project binding for: ${projectKey}`);
  try {
    const response = await client.get('/api/alm_settings/get_binding', { params: { project: projectKey } });
    return response.data;
  } catch (error) { logger.debug(`No binding found for project ${projectKey}: ${error.message}`); return null; }
}

export async function getSystemInfo(client) {
  logger.info('Fetching system info');
  try {
    const response = await client.get('/api/system/info');
    return response.data;
  } catch (error) {
    logger.warn(`Failed to get system info (may require admin): ${error.message}`);
    const statusResponse = await client.get('/api/system/status');
    return statusResponse.data;
  }
}

export async function getInstalledPlugins(client) {
  logger.info('Fetching installed plugins');
  try {
    const response = await client.get('/api/plugins/installed');
    return response.data.plugins || [];
  } catch (error) { logger.warn(`Failed to get installed plugins: ${error.message}`); return []; }
}

export async function getWebhooks(client, projectKey = null) {
  const scope = projectKey ? ' for project: ' + projectKey : ' (server-level)';
  logger.info(`Fetching webhooks${scope}`);
  const params = {};
  if (projectKey) params.project = projectKey;
  try {
    const response = await client.get('/api/webhooks/list', { params });
    return response.data.webhooks || [];
  } catch (error) { logger.warn(`Failed to get webhooks: ${error.message}`); return []; }
}
