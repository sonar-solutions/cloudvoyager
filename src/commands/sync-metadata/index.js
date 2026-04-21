// -------- Sync Metadata Command --------

import logger from '../../shared/utils/logger.js';
import { ShutdownCoordinator } from '../../shared/utils/shutdown.js';
import { handleSyncMetadataAction } from './helpers/handle-sync-metadata-action.js';
import { handleCommandError } from '../transfer/helpers/handle-command-error.js';

export function registerSyncMetadataCommand(program) {
  program
    .command('sync-metadata')
    .description('Sync issue and hotspot metadata for already-migrated projects')
    .requiredOption('-c, --config <path>', 'Path to migration configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--skip-issue-metadata-sync', 'Skip syncing issue metadata')
    .option('--skip-hotspot-metadata-sync', 'Skip syncing hotspot metadata')
    .option('--skip-quality-profile-sync', 'Skip syncing quality profiles')
    .option('--concurrency <n>', 'Override max concurrency', (val) => {
      const n = Number.parseInt(val, 10);
      if (Number.isNaN(n) || n < 1) throw new Error(`--concurrency must be a positive integer, got: "${val}"`);
      return n;
    })
    .option('--max-memory <mb>', 'Max heap size in MB', Number.parseInt)
    .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
    .option('--skip-all-branch-sync', 'Only sync main branch of each project')
    .action(async (options) => {
      const shutdownCoordinator = new ShutdownCoordinator();
      shutdownCoordinator.bind();

      try {
        if (options.verbose) logger.level = 'debug';
        logger.info('=== CloudVoyager - Issue & Hotspot Metadata Sync ===');
        await handleSyncMetadataAction(options, shutdownCoordinator);
        logger.info('=== Metadata sync completed successfully ===');
        process.exit(0);
      } catch (error) {
        handleCommandError(error, 'Metadata sync');
      }
    });
}
