import { readFile } from 'node:fs/promises';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { configSchema, migrateConfigSchema } from './schema.js';
import { ConfigurationError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const ajv = new Ajv({ allErrors: true, useDefaults: true });
addFormats(ajv);
const validate = ajv.compile(configSchema);

/**
 * Load and validate configuration from file
 * @param {string} configPath - Path to configuration file
 * @returns {Promise<object>} Validated configuration object
 */
export async function loadConfig(configPath) {
  try {
    logger.info(`Loading configuration from: ${configPath}`);

    // Read config file
    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Apply environment variable overrides
    applyEnvironmentOverrides(config);

    // Validate against schema
    const valid = validate(config);

    if (!valid) {
      const errors = validate.errors.map(err => {
        return `${err.instancePath} ${err.message}`;
      });
      throw new ValidationError('Configuration validation failed', errors);
    }

    // Apply defaults
    if (!config.sonarcloud.url) {
      config.sonarcloud.url = 'https://sonarcloud.io';
    }

    if (!config.transfer) {
      config.transfer = {};
    }

    if (!config.transfer.mode) {
      config.transfer.mode = 'incremental';
    }

    if (!config.transfer.stateFile) {
      config.transfer.stateFile = './.cloudvoyager-state.json';
    }

    if (!config.transfer.batchSize) {
      config.transfer.batchSize = 100;
    }

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

/**
 * Apply environment variable overrides to config
 * @param {object} config - Configuration object
 */
function applyEnvironmentOverrides(config) {
  // Allow sensitive tokens to be overridden via environment variables
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

/**
 * Validate configuration object without loading from file
 * @param {object} config - Configuration object to validate
 * @returns {boolean} True if valid
 * @throws {ValidationError} If validation fails
 */
/**
 * Validate that project keys are present in config (for single-project commands)
 * @param {object} config - Validated config object
 * @throws {ConfigurationError} If project keys are missing
 */
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
    const errors = validate.errors.map(err => {
      return `${err.instancePath} ${err.message}`;
    });
    throw new ValidationError('Configuration validation failed', errors);
  }

  return true;
}

/**
 * Load and validate migration configuration (multi-org format)
 * @param {string} configPath - Path to configuration file
 * @returns {Promise<object>} Validated migration configuration
 */
export async function loadMigrateConfig(configPath) {
  try {
    logger.info(`Loading migration configuration from: ${configPath}`);

    const configContent = await readFile(configPath, 'utf-8');
    const config = JSON.parse(configContent);

    // Apply environment variable overrides
    if (process.env.SONARQUBE_TOKEN) {
      config.sonarqube.token = process.env.SONARQUBE_TOKEN;
    }
    if (process.env.SONARQUBE_URL) {
      config.sonarqube.url = process.env.SONARQUBE_URL;
    }

    // Validate against migrate schema
    const migrateValidate = ajv.compile(migrateConfigSchema);
    const valid = migrateValidate(config);

    if (!valid) {
      const errors = migrateValidate.errors.map(err => `${err.instancePath} ${err.message}`);
      throw new ValidationError('Migration configuration validation failed', errors);
    }

    // Apply defaults
    if (!config.transfer) {
      config.transfer = { mode: 'full', batchSize: 100 };
    }
    if (!config.migrate) {
      config.migrate = {};
    }
    if (!config.migrate.outputDir) {
      config.migrate.outputDir = './migration-output';
    }

    // Apply defaults to each organization
    for (const org of config.sonarcloud.organizations) {
      if (!org.url) {
        org.url = 'https://sonarcloud.io';
      }
    }

    logger.info('Migration configuration loaded and validated successfully');
    return config;
  } catch (error) {
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
}
