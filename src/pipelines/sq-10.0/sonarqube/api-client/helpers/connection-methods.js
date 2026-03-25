import logger from '../../../../../shared/utils/logger.js';

// -------- Connection & Server Methods --------

export async function testConnection(client) {
  try {
    logger.info('Testing connection to SonarQube...');
    await client.get('/api/system/status');
    logger.info('Successfully connected to SonarQube');
    return true;
  } catch (error) {
    logger.error(`Failed to connect to SonarQube: ${error.message}`);
    throw error;
  }
}

export async function getServerVersion(client) {
  try {
    const response = await client.get('/api/system/status');
    return response.data.version || 'unknown';
  } catch (error) {
    logger.warn(`Failed to get server version: ${error.message}`);
    return 'unknown';
  }
}
