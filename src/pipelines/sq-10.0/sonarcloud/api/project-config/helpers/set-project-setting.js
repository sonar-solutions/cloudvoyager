// -------- Set Project Setting --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setProjectSetting(client, key, value, component) {
  logger.debug(`Setting ${key} on project ${component}`);
  await client.post('/api/settings/set', null, { params: { key, value, component } });
}
