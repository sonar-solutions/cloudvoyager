import logger from '../../../../../../shared/utils/logger.js';

// -------- Get System Info --------

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
  } catch (error) {
    logger.warn(`Failed to get installed plugins: ${error.message}`);
    return [];
  }
}
