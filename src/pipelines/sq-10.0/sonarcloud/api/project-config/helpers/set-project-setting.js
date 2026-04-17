// -------- Set Project Setting --------

import logger from '../../../../../../shared/utils/logger.js';
import { buildSettingsParams } from '../../../../../../shared/utils/settings-params.js';

export async function setProjectSetting(client, key, { value, values, fieldValues } = {}, component) {
  logger.debug(`Setting ${key} on project ${component}`);
  const params = buildSettingsParams({ key, component, value, values, fieldValues });
  await client.post(`/api/settings/set?${params.toString()}`, null);
}
