import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch project links from SonarQube.
export async function getProjectLinks(client, projectKey) {
  logger.info(`Fetching project links for: ${projectKey}`);
  const response = await client.get('/api/project_links/search', { params: { projectKey } });
  return response.data.links || [];
}
