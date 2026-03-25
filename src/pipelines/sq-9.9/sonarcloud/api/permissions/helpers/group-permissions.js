import logger from '../../../../../../shared/utils/logger.js';

// -------- Group Permission API Methods --------

export async function createGroup(client, organization, name, description = '') {
  logger.info(`Creating group: ${name}`);
  const response = await client.post('/api/user_groups/create', null, { params: { name, description, organization } });
  return response.data.group;
}

export async function addGroupPermission(client, organization, groupName, permission) {
  logger.debug(`Adding ${permission} permission to group ${groupName}`);
  await client.post('/api/permissions/add_group', null, { params: { groupName, permission, organization } });
}

export async function addProjectGroupPermission(client, organization, groupName, projectKey, permission) {
  logger.debug(`Adding ${permission} to group ${groupName} on project ${projectKey}`);
  await client.post('/api/permissions/add_group', null, { params: { groupName, projectKey, permission, organization } });
}
