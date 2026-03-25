import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Quality profile API calls.

export async function getAllQualityProfiles(client) {
  logger.info('Fetching all quality profiles');
  const response = await client.get('/api/qualityprofiles/search');
  return response.data.profiles || [];
}

export async function getQualityProfileBackup(client, language, qualityProfile) {
  logger.debug(`Fetching quality profile backup: ${qualityProfile} (${language})`);
  const response = await client.get('/api/qualityprofiles/backup', {
    params: { language, qualityProfile },
    responseType: 'text'
  });
  return response.data;
}

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
