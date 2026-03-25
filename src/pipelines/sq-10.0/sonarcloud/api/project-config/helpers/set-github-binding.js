// -------- Set GitHub Binding --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setGithubBinding(client, projectKey, almSetting, repository, monorepo = false) {
  logger.debug(`Setting GitHub binding for ${projectKey}: ${repository}`);
  await client.post('/api/alm_settings/set_github_binding', null, {
    params: { project: projectKey, almSetting, repository, monorepo }
  });
}
