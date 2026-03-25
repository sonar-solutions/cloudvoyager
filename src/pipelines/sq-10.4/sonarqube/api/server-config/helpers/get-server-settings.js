import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch server-level settings from SonarQube.
export async function getServerSettings(client) {
  logger.info('Fetching server-level settings');
  const response = await client.get('/api/settings/values');
  return response.data.settings || [];
}
