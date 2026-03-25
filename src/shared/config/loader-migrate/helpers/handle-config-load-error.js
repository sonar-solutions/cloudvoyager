// -------- Handle Config Load Error --------
import { ConfigurationError, ValidationError } from '../../../utils/errors.js';
import logger from '../../../utils/logger.js';

export function handleConfigLoadError(error, configPath) {
  if (error instanceof ValidationError) {
    logger.error('Migration configuration validation failed:');
    error.errors.forEach(err => logger.error(`  - ${err}`));
    throw error;
  }
  if (error instanceof SyntaxError) throw new ConfigurationError(`Invalid JSON in configuration file: ${error.message}`);
  if (error.code === 'ENOENT') throw new ConfigurationError(`Configuration file not found: ${configPath}`);
  throw new ConfigurationError(`Failed to load configuration: ${error.message}`);
}
