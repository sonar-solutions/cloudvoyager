// -------- Transfer Command --------

import logger from '../../shared/utils/logger.js';
import { ShutdownCoordinator } from '../../shared/utils/shutdown.js';
import { handleTransferAction } from './helpers/handle-transfer-action.js';
import { handleCommandError } from './helpers/handle-command-error.js';

export function registerTransferCommand(program) {
  program
    .command('transfer')
    .description('Transfer data from SonarQube to SonarCloud')
    .requiredOption('-c, --config <path>', 'Path to configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--wait', 'Wait for analysis to complete before returning')
    .option('--concurrency <n>', 'Override max concurrency for I/O operations', (val) => {
      const n = Number.parseInt(val, 10);
      if (Number.isNaN(n) || n < 1) throw new Error(`--concurrency must be a positive integer, got: "${val}"`);
      return n;
    })
    .option('--max-memory <mb>', 'Max heap size in MB (auto-restarts with increased heap if needed)', Number.parseInt)
    .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
    .option('--skip-all-branch-sync', 'Only sync the main branch (skip non-main branches)')
    .option('--force-restart', 'Discard checkpoint journal and start from scratch')
    .option('--force-fresh-extract', 'Discard extraction caches and re-extract everything')
    .option('--force-unlock', 'Force release a stale lock file from a previous run')
    .option('--show-progress', 'Display checkpoint progress and exit')
    .action(async (options) => {
      const shutdownCoordinator = new ShutdownCoordinator();
      shutdownCoordinator.bind();

      try {
        if (options.verbose) logger.level = 'debug';
        await handleTransferAction(options, shutdownCoordinator);
        logger.info('=== Transfer completed successfully ===');
        process.exit(0);
      } catch (error) {
        handleCommandError(error, 'Transfer');
      }
    });
}
