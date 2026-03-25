import logger from '../../../../../../shared/utils/logger.js';

// -------- Set Project Setting --------

export async function setProjectSetting(client, key, value, component) {
  logger.debug(`Setting ${key} on project ${component}`);
  await client.post('/api/settings/set', null, { params: { key, value, component } });
}
