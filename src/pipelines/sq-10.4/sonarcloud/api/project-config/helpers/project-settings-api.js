import logger from '../../../../../../shared/utils/logger.js';
import { buildSettingsParams } from '../../../../../../shared/utils/settings-params.js';

// -------- Main Logic --------

// SonarCloud project settings and tags API calls.

export async function setProjectSetting(client, key, { value, values, fieldValues } = {}, component) {
  logger.debug(`Setting ${key} on project ${component}`);
  const params = buildSettingsParams({ key, component, value, values, fieldValues });
  await client.post('/api/settings/set', params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
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
