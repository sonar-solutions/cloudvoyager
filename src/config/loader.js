import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { configSchema } from './schema.js';
import { ConfigurationError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

export { loadMigrateConfig } from './loader-migrate.js';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);
const validate = ajv.compile(configSchema);

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
    if (error instanceof SyntaxError) {
      throw new ConfigurationError(`Invalid JSON in configuration file: ${error.message}`);
    }
    if (error.code === 'ENOENT') {
      throw new ConfigurationError(`Configuration file not found: ${configPath}`);
    }
    throw new ConfigurationError(`Failed to load configuration: ${error.message}`);
  }
}

function applyEnvironmentOverrides(config) {
  if (process.env.SONARQUBE_TOKEN) {
    config.sonarqube.token = process.env.SONARQUBE_TOKEN;
    logger.debug('Overriding SonarQube token from environment variable');
  }
  if (process.env.SONARCLOUD_TOKEN) {
    config.sonarcloud.token = process.env.SONARCLOUD_TOKEN;
    logger.debug('Overriding SonarCloud token from environment variable');
  }
  if (process.env.SONARQUBE_URL) {
    config.sonarqube.url = process.env.SONARQUBE_URL;
    logger.debug('Overriding SonarQube URL from environment variable');
  }
  if (process.env.SONARCLOUD_URL) {
    config.sonarcloud.url = process.env.SONARCLOUD_URL;
    logger.debug('Overriding SonarCloud URL from environment variable');
  }
}

export function requireProjectKeys(config) {
  if (!config.sonarqube.projectKey) {
    throw new ConfigurationError('sonarqube.projectKey is required for this command');
  }
  if (!config.sonarcloud.projectKey) {
    throw new ConfigurationError('sonarcloud.projectKey is required for this command');
  }
}

export function validateConfig(config) {
  const valid = validate(config);
  if (!valid) {
    const errors = validate.errors.map(err => `${err.instancePath} ${err.message}`);
    throw new ValidationError('Configuration validation failed', errors);
  }
  return true;
}
