// -------- Verify Command --------

import logger from '../../shared/utils/logger.js';
import { CloudVoyagerError } from '../../shared/utils/errors.js';
import { handleVerifyAction } from './helpers/handle-verify-action.js';

export function registerVerifyCommand(program) {
  program
    .command('verify')
    .description('Verify migration completeness by comparing SonarQube and SonarCloud data')
    .requiredOption('-c, --config <path>', 'Path to migration configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--only <components>', 'Only verify specific components (comma-separated)')
    .option('--output-dir <path>', 'Output directory for verification reports', './verification-output')
    .option('--concurrency <n>', 'Override max concurrency', (val) => {
      const n = Number.parseInt(val, 10);
      if (Number.isNaN(n) || n < 1) throw new Error(`--concurrency must be a positive integer, got: "${val}"`);
      return n;
    })
    .option('--max-memory <mb>', 'Max heap size in MB', Number.parseInt)
    .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
    .action(async (options) => {
      try {
        if (options.verbose) logger.level = 'debug';
        logger.info('=== CloudVoyager - Migration Verification ===');
        await handleVerifyAction(options);
        logger.info('=== Verification completed successfully — all checks passed ===');
        process.exit(0);
      } catch (error) {
        if (error instanceof CloudVoyagerError) {
          logger.error(`Verification failed: ${error.message}`);
        } else {
          logger.error(`Unexpected error: ${error.message}`);
          logger.debug(error.stack);
        }
        process.exit(1);
      }
    });
}
