// -------- Set Project Setting --------

import logger from '../../../../../../shared/utils/logger.js';

export async function setProjectSetting(client, key, { value, values, fieldValues } = {}, component) {
  logger.debug(`Setting ${key} on project ${component}`);
  const params = new URLSearchParams();
  params.append('key', key);
  params.append('component', component);
  if (value !== undefined && value !== null) params.append('value', value);
  if (values?.length) values.forEach(v => params.append('values', v));
  if (fieldValues?.length) fieldValues.forEach(fv => params.append('fieldValues', JSON.stringify(fv)));
  await client.post(`/api/settings/set?${params.toString()}`, null);
}
