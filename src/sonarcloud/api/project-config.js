import logger from '../../utils/logger.js';

export async function setProjectSetting(client, key, value, component) {
  logger.debug(`Setting ${key} on project ${component}`);

  await client.post('/api/settings/set', null, {
    params: { key, value, component }
  });
}

export async function setProjectTags(client, projectKey, tags) {
  logger.debug(`Setting tags on project ${projectKey}: ${tags.join(', ')}`);

  await client.post('/api/project_tags/set', null, {
    params: { project: projectKey, tags: tags.join(',') }
  });
}

export async function createProjectLink(client, projectKey, name, url) {
  logger.debug(`Creating project link: ${name} -> ${url}`);

  const response = await client.post('/api/project_links/create', null, {
    params: { projectKey, name, url }
  });

  return response.data.link;
}

export async function setGithubBinding(client, projectKey, almSetting, repository, monorepo = false) {
  logger.debug(`Setting GitHub binding for ${projectKey}: ${repository}`);

  await client.post('/api/alm_settings/set_github_binding', null, {
    params: { project: projectKey, almSetting, repository, monorepo }
  });
}

export async function setGitlabBinding(client, projectKey, almSetting, repository) {
  logger.debug(`Setting GitLab binding for ${projectKey}: ${repository}`);

  await client.post('/api/alm_settings/set_gitlab_binding', null, {
    params: { project: projectKey, almSetting, repository }
  });
}

export async function setAzureBinding(client, projectKey, almSetting, projectName, repositoryName) {
  logger.debug(`Setting Azure DevOps binding for ${projectKey}: ${projectName}/${repositoryName}`);

  await client.post('/api/alm_settings/set_azure_binding', null, {
    params: { project: projectKey, almSetting, projectName, repositoryName }
  });
}

export async function setBitbucketBinding(client, projectKey, almSetting, repository, slug) {
  logger.debug(`Setting Bitbucket binding for ${projectKey}: ${slug}/${repository}`);

  await client.post('/api/alm_settings/set_bitbucket_binding', null, {
    params: { project: projectKey, almSetting, repository, slug }
  });
}

export async function createPortfolio(client, organization, name, description = '', visibility = 'public', key = null) {
  logger.info(`Creating portfolio: ${name}`);

  const params = { name, description, visibility, organization };
  if (key) params.key = key;

  const response = await client.post('/api/views/create', null, { params });
  return response.data;
}

export async function addProjectToPortfolio(client, portfolioKey, projectKey) {
  logger.debug(`Adding project ${projectKey} to portfolio ${portfolioKey}`);

  await client.post('/api/views/add_project', null, {
    params: { key: portfolioKey, project: projectKey }
  });
}
