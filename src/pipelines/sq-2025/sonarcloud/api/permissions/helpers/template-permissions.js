import logger from '../../../../../../shared/utils/logger.js';

// -------- Template Permission Helpers --------

/** Create a permission template. */
export async function createPermissionTemplate(client, organization, name, description = '', projectKeyPattern = '') {
  logger.info(`Creating permission template: ${name}`);
  const params = { name, description, organization };
  if (projectKeyPattern) params.projectKeyPattern = projectKeyPattern;
  const response = await client.post('/api/permissions/create_template', null, { params });
  return response.data.permissionTemplate;
}

/** Add a group to a permission template. */
export async function addGroupToTemplate(client, organization, templateId, groupName, permission) {
  logger.debug(`Adding group ${groupName} with ${permission} to template ${templateId}`);
  await client.post('/api/permissions/add_group_to_template', null, {
    params: { templateId, groupName, permission, organization }
  });
}

/** Set the default permission template. */
export async function setDefaultTemplate(client, organization, templateId, qualifier = 'TRK') {
  logger.info(`Setting default permission template: ${templateId}`);
  await client.post('/api/permissions/set_default_template', null, {
    params: { templateId, qualifier, organization }
  });
}
