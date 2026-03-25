// -------- Set Bitbucket Binding --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setBitbucketBinding(client, projectKey, almSetting, repository, slug) {
  logger.debug(`Setting Bitbucket binding for ${projectKey}: ${slug}/${repository}`);
  await client.post('/api/alm_settings/set_bitbucket_binding', null, {
    params: { project: projectKey, almSetting, repository, slug }
  });
}
