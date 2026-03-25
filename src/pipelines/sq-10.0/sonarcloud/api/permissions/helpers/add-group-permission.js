// -------- Add Group Permission --------

import logger from '../../../../../../shared/utils/logger.js';

export async function addGroupPermission(client, organization, groupName, permission) {
  logger.debug(`Adding ${permission} permission to group ${groupName}`);
  await client.post('/api/permissions/add_group', null, {
    params: { groupName, permission, organization }
  });
}
