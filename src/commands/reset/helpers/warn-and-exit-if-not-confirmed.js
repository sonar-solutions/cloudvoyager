// -------- Warn And Exit If Not Confirmed --------

import logger from '../../../shared/utils/logger.js';

export function warnAndExitIfNotConfirmed(options) {
  if (options.yes) return;

  logger.warn('This will clear all sync state, checkpoint journals, and extraction caches.');
  logger.warn('The next transfer will be a full sync from scratch.');
  logger.warn('Re-run with --yes to proceed with the reset.');
  process.exit(0);
}
