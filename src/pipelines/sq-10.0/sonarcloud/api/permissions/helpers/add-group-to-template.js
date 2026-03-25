// -------- Add Group To Template --------

import logger from '../../../../../../shared/utils/logger.js';

export async function addGroupToTemplate(client, organization, templateId, groupName, permission) {
  logger.debug(`Adding group ${groupName} with ${permission} to template ${templateId}`);
  await client.post('/api/permissions/add_group_to_template', null, {
    params: { templateId, groupName, permission, organization }
  });
}
