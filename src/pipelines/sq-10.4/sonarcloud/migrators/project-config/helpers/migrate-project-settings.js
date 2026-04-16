import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Migrate project settings (non-inherited configuration values).
export async function migrateProjectSettings(projectKey, settings, client) {
  logger.info(`Migrating ${settings.length} project settings for ${projectKey}`);
  for (const setting of settings) {
    try {
      if (setting.value) {
        await client.setProjectSetting(setting.key, { value: setting.value }, projectKey);
      } else if (setting.values?.length) {
        await client.setProjectSetting(setting.key, { values: setting.values }, projectKey);
      } else if (setting.fieldValues?.length) {
        await client.setProjectSetting(setting.key, { fieldValues: setting.fieldValues }, projectKey);
      } else {
        continue;
      }
      logger.debug(`Set setting ${setting.key} on ${projectKey}`);
    } catch (error) {
      logger.warn(`Failed to set setting ${setting.key} on ${projectKey}: ${error.message}`);
    }
  }
}
