// -------- Set Project Setting --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setProjectSetting(client, key, valueOrValues, component) {
  logger.debug(`Setting ${key} on project ${component}`);
  if (Array.isArray(valueOrValues)) {
    // Multi-value setting: use repeated 'values' params (SonarCloud API requirement)
    const params = new URLSearchParams();
    params.set('key', key);
    params.set('component', component);
    valueOrValues.forEach(v => params.append('values', v));
    await client.post(`/api/settings/set?${params.toString()}`, null);
  } else {
    await client.post('/api/settings/set', null, { params: { key, value: valueOrValues, component } });
  }
}
