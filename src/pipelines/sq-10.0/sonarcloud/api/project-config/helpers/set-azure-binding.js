// -------- Set Azure Binding --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setAzureBinding(client, projectKey, almSetting, projectName, repositoryName) {
  logger.debug(`Setting Azure DevOps binding for ${projectKey}: ${projectName}/${repositoryName}`);
  await client.post('/api/alm_settings/set_azure_binding', null, {
    params: { project: projectKey, almSetting, projectName, repositoryName }
  });
}
