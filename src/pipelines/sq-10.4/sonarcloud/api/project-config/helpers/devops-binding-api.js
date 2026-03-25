import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// SonarCloud DevOps binding API calls.

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
