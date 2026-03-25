// -------- Set GitLab Binding --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setGitlabBinding(client, projectKey, almSetting, repository) {
  logger.debug(`Setting GitLab binding for ${projectKey}: ${repository}`);
  await client.post('/api/alm_settings/set_gitlab_binding', null, {
    params: { project: projectKey, almSetting, repository }
  });
}
