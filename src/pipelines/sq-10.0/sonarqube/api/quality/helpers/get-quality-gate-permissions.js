// -------- Get Quality Gate Permissions --------

import logger from '../../../../../../shared/utils/logger.js';

export async function getQualityGatePermissions(client, gateName) {
  logger.debug(`Fetching quality gate permissions for: ${gateName}`);
  const permissions = { users: [], groups: [] };

  try {
    const usersResponse = await client.get('/api/qualitygates/search_users', {
      params: { gateName, ps: 100 }
    });
    permissions.users = usersResponse.data.users || [];
  } catch (error) {
    logger.debug(`Failed to get gate user permissions: ${error.message}`);
  }

  try {
    const groupsResponse = await client.get('/api/qualitygates/search_groups', {
      params: { gateName, ps: 100 }
    });
    permissions.groups = groupsResponse.data.groups || [];
  } catch (error) {
    logger.debug(`Failed to get gate group permissions: ${error.message}`);
  }

  return permissions;
}
