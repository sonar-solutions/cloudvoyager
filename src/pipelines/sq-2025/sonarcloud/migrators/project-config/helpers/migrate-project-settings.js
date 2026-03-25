import logger from '../../../../../../shared/utils/logger.js';

// -------- Migrate Project Settings --------

/** Migrate non-inherited project settings to SonarCloud. */
export async function migrateProjectSettings(projectKey, settings, client) {
  logger.info(`Migrating ${settings.length} project settings for ${projectKey}`);

  for (const setting of settings) {
    try {
      const value = setting.value || (setting.values ? setting.values.join(',') : '');
      if (value) {
        await client.setProjectSetting(setting.key, value, projectKey);
        logger.debug(`Set setting ${setting.key} on ${projectKey}`);
      }
    } catch (error) {
      logger.debug(`Failed to set setting ${setting.key} on ${projectKey}: ${error.message}`);
    }
  }
}
