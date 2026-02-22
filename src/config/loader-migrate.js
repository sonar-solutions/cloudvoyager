import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { migrateConfigSchema } from './schema.js';
import { ConfigurationError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);

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

function applyMigrateEnvOverrides(config) {
  if (process.env.SONARQUBE_TOKEN) {
    config.sonarqube.token = process.env.SONARQUBE_TOKEN;
  }
  if (process.env.SONARQUBE_URL) {
    config.sonarqube.url = process.env.SONARQUBE_URL;
  }
}

function validateMigrateSchema(config) {
  const migrateValidate = ajv.compile(migrateConfigSchema);
  const valid = migrateValidate(config);
  if (!valid) {
    const errors = migrateValidate.errors.map(err => `${err.instancePath} ${err.message}`);
    throw new ValidationError('Migration configuration validation failed', errors);
  }
}

function applyMigrateDefaults(config) {
  if (!config.transfer) {
    config.transfer = { mode: 'full', batchSize: 100 };
  }
  if (!config.migrate) {
    config.migrate = {};
  }
  if (!config.migrate.outputDir) {
    config.migrate.outputDir = './migration-output';
  }
}

function handleConfigLoadError(error, configPath) {
  if (error instanceof ValidationError) {
    logger.error('Migration configuration validation failed:');
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
