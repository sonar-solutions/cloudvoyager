import logger from '../../../../../../shared/utils/logger.js';

// -------- Create Project Link --------

export async function createProjectLink(client, projectKey, name, url) {
  logger.debug(`Creating project link: ${name} -> ${url}`);
  const response = await client.post('/api/project_links/create', null, {
    params: { projectKey, name, url },
  });
  return response.data.link;
}
