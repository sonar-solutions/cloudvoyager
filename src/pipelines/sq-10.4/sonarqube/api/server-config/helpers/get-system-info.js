import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch system info from SonarQube (falls back to status endpoint if admin-only).
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
