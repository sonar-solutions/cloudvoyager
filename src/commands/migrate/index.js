// -------- Migrate Command --------

import logger from '../../shared/utils/logger.js';
import { ShutdownCoordinator } from '../../shared/utils/shutdown.js';
import { handleMigrateAction } from './helpers/handle-migrate-action.js';
import { handleCommandError } from '../transfer/helpers/handle-command-error.js';

export { VALID_ONLY_COMPONENTS } from './helpers/valid-only-components.js';

export function registerMigrateCommand(program) {
  program
    .command('migrate')
    .description('Full migration from SonarQube to one or more SonarCloud organizations')
    .requiredOption('-c, --config <path>', 'Path to migration configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--wait', 'Wait for analysis to complete before returning')
    .option('--dry-run', 'Extract data and generate mappings without migrating')
    .option('--skip-issue-metadata-sync', 'Skip syncing issue metadata')
    .option('--skip-hotspot-metadata-sync', 'Skip syncing hotspot metadata')
    .option('--skip-quality-profile-sync', 'Skip syncing quality profiles')
    .option('--only <components>', 'Only migrate specific components (comma-separated)')
    .option('--concurrency <n>', 'Override max concurrency', (val) => {
      const n = Number.parseInt(val, 10);
      if (Number.isNaN(n) || n < 1) throw new Error(`--concurrency must be a positive integer, got: "${val}"`);
      return n;
    })
    .option('--max-memory <mb>', 'Max heap size in MB', Number.parseInt)
    .option('--project-concurrency <n>', 'Max concurrent project migrations', (val) => Math.max(1, Number.parseInt(val, 10) || 1))
    .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
    .option('--skip-all-branch-sync', 'Only sync main branch of each project')
    .option('--force-restart', 'Discard migration journal and start from scratch')
    .option('--force-unlock', 'Force release a stale lock file')
    .action(async (options) => {
      const shutdownCoordinator = new ShutdownCoordinator();
      shutdownCoordinator.bind();

      try {
        if (options.verbose) logger.level = 'debug';
        logger.info('=== CloudVoyager - Full Organization Migration ===');
        await handleMigrateAction(options, shutdownCoordinator);
        logger.info('=== Migration completed successfully ===');
        process.exit(0);
      } catch (error) {
        handleCommandError(error, 'Migration');
      }
    });
}
