import logger from '../../../../../../shared/utils/logger.js';

// -------- Group Permission Helpers --------

/** Create a group in the organization. */
export async function createGroup(client, organization, name, description = '') {
  logger.info(`Creating group: ${name}`);
  const response = await client.post('/api/user_groups/create', null, {
    params: { name, description, organization }
  });
  return response.data.group;
}

/** Add a global permission to a group. */
export async function addGroupPermission(client, organization, groupName, permission) {
  logger.debug(`Adding ${permission} permission to group ${groupName}`);
  await client.post('/api/permissions/add_group', null, {
    params: { groupName, permission, organization }
  });
}

/** Add a project-level permission to a group. */
export async function addProjectGroupPermission(client, organization, groupName, projectKey, permission) {
  logger.debug(`Adding ${permission} to group ${groupName} on project ${projectKey}`);
  await client.post('/api/permissions/add_group', null, {
    params: { groupName, projectKey, permission, organization }
  });
}
