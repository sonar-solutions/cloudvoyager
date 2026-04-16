import logger from '../../../../../../shared/utils/logger.js';
import { dispatchSettingToApi } from '../../../../../../shared/utils/settings-params.js';

// -------- Migrate Project Settings --------

export async function migrateProjectSettings(projectKey, settings, client) {
  logger.info(`Migrating ${settings.length} project settings for ${projectKey}`);

  for (const setting of settings) {
    try {
      await dispatchSettingToApi(client, setting, projectKey);
    } catch (error) {
      logger.warn(`Failed to set setting ${setting.key} on ${projectKey}: ${error.message}`);
    }
  }
}
