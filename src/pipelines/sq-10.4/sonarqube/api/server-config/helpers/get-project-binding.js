import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch DevOps platform binding for a specific project.
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
