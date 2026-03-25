import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch project-level settings from SonarQube.
export async function getProjectSettings(client, projectKey) {
  logger.info(`Fetching project settings for: ${projectKey}`);
  const response = await client.get('/api/settings/values', { params: { component: projectKey } });
  return response.data.settings || [];
}
