import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Quality gate API calls.

export async function getQualityGates(client) {
  logger.info('Fetching all quality gates');
  const response = await client.get('/api/qualitygates/list');
  return response.data;
}

export async function getQualityGateDetails(client, name) {
  logger.debug(`Fetching quality gate details: ${name}`);
  const response = await client.get('/api/qualitygates/show', { params: { name } });
  return response.data;
}

export async function getQualityGatePermissions(client, gateName) {
  logger.debug(`Fetching quality gate permissions for: ${gateName}`);
  const permissions = { users: [], groups: [] };
  try {
    const usersResponse = await client.get('/api/qualitygates/search_users', { params: { gateName, ps: 100 } });
    permissions.users = usersResponse.data.users || [];
  } catch (error) {
    logger.debug(`Failed to get gate user permissions: ${error.message}`);
  }
  try {
    const groupsResponse = await client.get('/api/qualitygates/search_groups', { params: { gateName, ps: 100 } });
    permissions.groups = groupsResponse.data.groups || [];
  } catch (error) {
    logger.debug(`Failed to get gate group permissions: ${error.message}`);
  }
  return permissions;
}
