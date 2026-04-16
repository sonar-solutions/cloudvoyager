import logger from './logger.js';

/**
 * Build URLSearchParams for the SonarCloud POST /api/settings/set endpoint.
 *
 * Handles the three value shapes the API accepts:
 *  - scalar `value` for single-value settings
 *  - repeated `values` for multi-value (TEXT_ARRAY) settings
 *  - repeated `fieldValues` (JSON-encoded) for property-set settings
 */
export function buildSettingsParams({ key, component, value, values, fieldValues }) {
  const params = new URLSearchParams();
  params.append('key', key);
  params.append('component', component);
  if (value !== undefined && value !== null) params.append('value', value);
  if (values?.length) values.forEach(v => params.append('values', v));
  if (fieldValues?.length) fieldValues.forEach(fv => params.append('fieldValues', JSON.stringify(fv)));
  return params;
}

/**
 * Resolve which value shape a setting carries and forward it to the client API.
 * Returns true if a value was dispatched, false if the setting was empty/skipped.
 */
export async function dispatchSettingToApi(client, setting, projectKey) {
  if (setting.value) {
    await client.setProjectSetting(setting.key, { value: setting.value }, projectKey);
  } else if (setting.values?.length) {
    await client.setProjectSetting(setting.key, { values: setting.values }, projectKey);
  } else if (setting.fieldValues?.length) {
    await client.setProjectSetting(setting.key, { fieldValues: setting.fieldValues }, projectKey);
  } else {
    return false;
  }
  logger.debug(`Set setting ${setting.key} on ${projectKey}`);
  return true;
}
