import logger from '../../../../../../shared/utils/logger.js';

// -------- Get ALM Settings --------

export async function getAlmSettings(client) {
  logger.info('Fetching ALM/DevOps settings');
  try {
    const response = await client.get('/api/alm_settings/list_definitions');
    return response.data;
  } catch (error) {
    logger.warn(`Failed to get ALM settings: ${error.message}`);
    return {};
  }
}

export async function getProjectBinding(client, projectKey) {
  logger.debug(`Fetching project binding for: ${projectKey}`);
  try {
    const response = await client.get('/api/alm_settings/get_binding', { params: { project: projectKey } });
    return response.data;
  } catch (error) {
    logger.debug(`No binding found for project ${projectKey}: ${error.message}`);
    return null;
  }
}
