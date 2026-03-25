// -------- Create Group --------

import logger from '../../../../../../shared/utils/logger.js';

export async function createGroup(client, organization, name, description = '') {
  logger.info(`Creating group: ${name}`);
  const response = await client.post('/api/user_groups/create', null, {
    params: { name, description, organization }
  });
  return response.data.group;
}
