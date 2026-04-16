import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// SonarCloud project settings and tags API calls.

export async function setProjectSetting(client, key, { value, values, fieldValues } = {}, component) {
  logger.debug(`Setting ${key} on project ${component}`);
  const params = new URLSearchParams();
  params.append('key', key);
  params.append('component', component);
  if (value !== undefined && value !== null) params.append('value', value);
  if (values?.length) values.forEach(v => params.append('values', v));
  if (fieldValues?.length) fieldValues.forEach(fv => params.append('fieldValues', JSON.stringify(fv)));
  await client.post(`/api/settings/set?${params.toString()}`, null);
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
