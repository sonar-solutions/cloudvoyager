import logger from '../../../../../../shared/utils/logger.js';
import { dispatchSettingToApi } from '../../../../../../shared/utils/settings-params.js';

// -------- Migrate Project Settings --------

/** Migrate non-inherited project settings to SonarCloud. */
export async function migrateProjectSettings(projectKey, settings, client) {
  if (!settings.length) { logger.info(`No project settings to migrate for ${projectKey}`); return; }
  logger.info(`Migrating ${settings.length} project setting(s) for ${projectKey}: ${settings.map(s => s.key).join(', ')}`);

  let ok = 0; let fail = 0; let skip = 0;
  for (const setting of settings) {
    try {
      const dispatched = await dispatchSettingToApi(client, setting, projectKey);
      if (dispatched) ok++; else skip++;
    } catch (error) {
      fail++;
      logger.warn(`Failed to set setting ${setting.key} on ${projectKey}: ${error.message}`);
    }
  }
  logger.info(`Project settings for ${projectKey}: ${ok} applied, ${fail} failed, ${skip} skipped`);
}
