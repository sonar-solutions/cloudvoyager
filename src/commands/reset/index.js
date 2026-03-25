// -------- Reset Command --------

import { readFileSync } from 'node:fs';
import logger from '../../shared/utils/logger.js';
import { warnAndExitIfNotConfirmed } from './helpers/warn-and-exit-if-not-confirmed.js';
import { resetStateFile } from './helpers/reset-state-file.js';
import { clearJournalFiles } from './helpers/clear-journal-files.js';
import { clearLockAndCache } from './helpers/clear-lock-and-cache.js';

export function registerResetCommand(program) {
  program
    .command('reset')
    .description('Reset state and clear sync history')
    .requiredOption('-c, --config <path>', 'Path to configuration file')
    .option('-y, --yes', 'Skip confirmation prompt')
    .action(async (options) => {
      try {
        const raw = JSON.parse(readFileSync(options.config, 'utf8'));
        warnAndExitIfNotConfirmed(options);
        const stateFile = raw.transfer?.stateFile || './.cloudvoyager-state.json';
        await resetStateFile(stateFile);
        await clearJournalFiles(stateFile);
        await clearLockAndCache(stateFile);
        logger.info('Full reset complete — all state, journals, and caches cleared');
      } catch (error) {
        logger.error(`Failed to reset state: ${error.message}`);
        process.exit(1);
      }
    });
}
