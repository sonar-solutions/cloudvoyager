import logger from '../../utils/logger.js';

export async function createGroup(client, organization, name, description = '') {
  logger.info(`Creating group: ${name}`);

  const response = await client.post('/api/user_groups/create', null, {
    params: { name, description, organization }
  });

  return response.data.group;
}

export async function addGroupPermission(client, organization, groupName, permission) {
  logger.debug(`Adding ${permission} permission to group ${groupName}`);

  await client.post('/api/permissions/add_group', null, {
    params: { groupName, permission, organization }
  });
}

export async function addProjectGroupPermission(client, organization, groupName, projectKey, permission) {
  logger.debug(`Adding ${permission} to group ${groupName} on project ${projectKey}`);

  await client.post('/api/permissions/add_group', null, {
    params: { groupName, projectKey, permission, organization }
  });
}

export async function createPermissionTemplate(client, organization, name, description = '', projectKeyPattern = '') {
  logger.info(`Creating permission template: ${name}`);

  const params = { name, description, organization };
  if (projectKeyPattern) {
    params.projectKeyPattern = projectKeyPattern;
  }

  const response = await client.post('/api/permissions/create_template', null, { params });
  return response.data.permissionTemplate;
}

export async function addGroupToTemplate(client, organization, templateId, groupName, permission) {
  logger.debug(`Adding group ${groupName} with ${permission} to template ${templateId}`);

  await client.post('/api/permissions/add_group_to_template', null, {
    params: { templateId, groupName, permission, organization }
  });
}

export async function setDefaultTemplate(client, organization, templateId, qualifier = 'TRK') {
  logger.info(`Setting default permission template: ${templateId}`);

  await client.post('/api/permissions/set_default_template', null, {
    params: { templateId, qualifier, organization }
  });
}
