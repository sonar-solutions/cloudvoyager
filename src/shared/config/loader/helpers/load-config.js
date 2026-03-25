// -------- Load Config --------
import { readFile } from 'node:fs/promises';
import { ConfigurationError, ValidationError } from '../../../utils/errors.js';
import logger from '../../../utils/logger.js';
import { validate } from './create-validator.js';
import { applyEnvironmentOverrides } from './apply-environment-overrides.js';

export async function loadConfig(configPath) {
  try {
    logger.info(`Loading configuration from: ${configPath}`);
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    applyEnvironmentOverrides(config);
    const valid = validate(config);
    if (!valid) {
      const errors = validate.errors.map(err => `${err.instancePath} ${err.message}`);
      throw new ValidationError('Configuration validation failed', errors);
    }
    if (!config.transfer) config.transfer = {};
    if (!config.transfer.mode) config.transfer.mode = 'incremental';
    if (!config.transfer.stateFile) config.transfer.stateFile = './.cloudvoyager-state.json';
    if (!config.transfer.batchSize) config.transfer.batchSize = 100;
    logger.info('Configuration loaded and validated successfully');
    return config;
  } catch (error) {
    if (error instanceof ValidationError) {
      logger.error('Configuration validation failed:');
      error.errors.forEach(err => logger.error(`  - ${err}`));
      throw error;
    }
    if (error instanceof SyntaxError) throw new ConfigurationError(`Invalid JSON in configuration file: ${error.message}`);
    if (error.code === 'ENOENT') throw new ConfigurationError(`Configuration file not found: ${configPath}`);
    throw new ConfigurationError(`Failed to load configuration: ${error.message}`);
  }
}
