// -------- Create Permission Template --------

import logger from '../../../../../../shared/utils/logger.js';

export async function createPermissionTemplate(client, organization, name, description = '', projectKeyPattern = '') {
  logger.info(`Creating permission template: ${name}`);
  const params = { name, description, organization };
  if (projectKeyPattern) params.projectKeyPattern = projectKeyPattern;

  const response = await client.post('/api/permissions/create_template', null, { params });
  return response.data.permissionTemplate;
}
