// -------- Add Project Group Permission --------

import logger from '../../../../../../shared/utils/logger.js';

export async function addProjectGroupPermission(client, organization, groupName, projectKey, permission) {
  logger.debug(`Adding ${permission} to group ${groupName} on project ${projectKey}`);
  await client.post('/api/permissions/add_group', null, {
    params: { groupName, projectKey, permission, organization }
  });
}
