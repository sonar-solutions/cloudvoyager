import logger from '../../../../../../shared/utils/logger.js';
import { mapConcurrent } from '../../../../../../shared/utils/concurrency/helpers/map-concurrent.js';

// -------- Main Logic --------

// Migrate project settings (non-inherited configuration values).
export async function migrateProjectSettings(projectKey, settings, client, { concurrency = 10 } = {}) {
  logger.info(`Migrating ${settings.length} project settings for ${projectKey}`);

  await mapConcurrent(settings, async (setting) => {
    try {
      if (setting.values && setting.values.length > 0) {
        // Multi-value setting: pass array so API layer uses repeated 'values' params
        await client.setProjectSetting(setting.key, setting.values, projectKey);
      } else if (setting.value) {
        await client.setProjectSetting(setting.key, setting.value, projectKey);
      }
      logger.debug(`Set setting ${setting.key} on ${projectKey}`);
    } catch (error) {
      logger.warn(`Failed to set setting ${setting.key} on ${projectKey}: ${error.message}`);
    }
  }, { concurrency, settled: true });
}
