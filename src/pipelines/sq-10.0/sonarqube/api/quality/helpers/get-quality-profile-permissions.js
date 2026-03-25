// -------- Get Quality Profile Permissions --------

import logger from '../../../../../../shared/utils/logger.js';

export async function getQualityProfilePermissions(client, language, qualityProfile) {
  logger.debug(`Fetching quality profile permissions for: ${qualityProfile} (${language})`);
  const permissions = { users: [], groups: [] };

  try {
    const usersResponse = await client.get('/api/qualityprofiles/search_users', {
      params: { qualityProfile, language, ps: 100 }
    });
    permissions.users = usersResponse.data.users || [];
  } catch (error) {
    logger.debug(`Failed to get profile user permissions: ${error.message}`);
  }

  try {
    const groupsResponse = await client.get('/api/qualityprofiles/search_groups', {
      params: { qualityProfile, language, ps: 100 }
    });
    permissions.groups = groupsResponse.data.groups || [];
  } catch (error) {
    logger.debug(`Failed to get profile group permissions: ${error.message}`);
  }

  return permissions;
}
