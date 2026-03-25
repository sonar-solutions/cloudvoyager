// -------- Set Default Template --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setDefaultTemplate(client, organization, templateId, qualifier = 'TRK') {
  logger.info(`Setting default permission template: ${templateId}`);
  await client.post('/api/permissions/set_default_template', null, {
    params: { templateId, qualifier, organization }
  });
}
