import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch installed plugins from SonarQube.
export async function getInstalledPlugins(client) {
  logger.info('Fetching installed plugins');
  try {
    const response = await client.get('/api/plugins/installed');
    return response.data.plugins || [];
  } catch (error) {
    logger.warn(`Failed to get installed plugins: ${error.message}`);
    return [];
  }
}
