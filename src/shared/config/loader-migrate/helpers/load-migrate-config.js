// -------- Load Migrate Config --------
import { readFile } from 'node:fs/promises';
import logger from '../../../utils/logger.js';
import { applyMigrateEnvOverrides } from './apply-migrate-env-overrides.js';
import { validateMigrateSchema } from './validate-migrate-schema.js';
import { applyMigrateDefaults } from './apply-migrate-defaults.js';
import { handleConfigLoadError } from './handle-config-load-error.js';

export async function loadMigrateConfig(configPath) {
  try {
    logger.info(`Loading migration configuration from: ${configPath}`);
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    applyMigrateEnvOverrides(config);
    validateMigrateSchema(config);
    applyMigrateDefaults(config);
    logger.info('Migration configuration loaded and validated successfully');
    return config;
  } catch (error) {
    handleConfigLoadError(error, configPath);
  }
}
