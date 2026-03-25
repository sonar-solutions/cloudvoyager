import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch ALM/DevOps platform settings from SonarQube.
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
