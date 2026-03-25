import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch project tags from SonarQube (project-scoped or server-wide).
export async function getProjectTags(client, projectKey = null) {
  const label = projectKey ? `for project: ${projectKey}` : '(server-wide)';
  logger.info(`Fetching project tags ${label}`);
  const params = { ps: 100 };
  if (projectKey) params.project = projectKey;
  const response = await client.get('/api/project_tags/search', { params });
  return response.data.tags || [];
}
