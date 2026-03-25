import logger from '../../../../../../shared/utils/logger.js';

// -------- Project Settings API Methods --------

export async function setProjectSetting(client, key, value, component) {
  logger.debug(`Setting ${key} on project ${component}`);
  await client.post('/api/settings/set', null, { params: { key, value, component } });
}

export async function setProjectTags(client, projectKey, tags) {
  logger.debug(`Setting tags on project ${projectKey}: ${tags.join(', ')}`);
  await client.post('/api/project_tags/set', null, { params: { project: projectKey, tags: tags.join(',') } });
}

export async function createProjectLink(client, projectKey, name, url) {
  logger.debug(`Creating project link: ${name} -> ${url}`);
  const response = await client.post('/api/project_links/create', null, { params: { projectKey, name, url } });
  return response.data.link;
}
