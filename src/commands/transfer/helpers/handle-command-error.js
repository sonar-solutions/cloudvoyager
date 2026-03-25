// -------- Handle Command Error --------

import logger from '../../../shared/utils/logger.js';
import { CloudVoyagerError, GracefulShutdownError } from '../../../shared/utils/errors.js';

export function handleCommandError(error, commandName) {
  if (error instanceof GracefulShutdownError) {
    logger.info(`${commandName} interrupted gracefully. Resume by running the same command again.`);
    process.exit(0);
  } else if (error instanceof CloudVoyagerError) {
    logger.error(`${commandName} failed: ${error.message}`);
  } else {
    logger.error(`Unexpected error: ${error.message}`);
    logger.debug(error.stack);
  }
  process.exit(1);
}
