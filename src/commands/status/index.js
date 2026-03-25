// -------- Status Command --------

import { existsSync, readFileSync } from 'node:fs';
import { StateTracker } from '../../shared/state/tracker.js';
import { ProgressTracker } from '../../shared/utils/progress.js';
import logger from '../../shared/utils/logger.js';

export function registerStatusCommand(program) {
  program
    .command('status')
    .description('Show current synchronization status')
    .requiredOption('-c, --config <path>', 'Path to configuration file')
    .action(async (options) => {
      try {
        const raw = JSON.parse(readFileSync(options.config, 'utf8'));
        const stateFile = raw.transfer?.stateFile || './.cloudvoyager-state.json';
        const stateTracker = new StateTracker(stateFile);
        await stateTracker.initialize();
        const summary = stateTracker.getSummary();

        logger.info('=== Synchronization Status ===');
        logger.info(`Last sync: ${summary.lastSync || 'Never'}`);
        logger.info(`Processed issues: ${summary.processedIssuesCount}`);
        logger.info(`Completed branches: ${summary.completedBranchesCount}`);
        if (summary.completedBranches.length > 0) {
          logger.info('Branches:');
          summary.completedBranches.forEach(branch => logger.info(`  - ${branch}`));
        }
        logger.info(`Sync history entries: ${summary.syncHistoryCount}`);

        const progressTracker = new ProgressTracker(stateFile);
        const journalPath = `${stateFile}.journal`;
        if (existsSync(journalPath)) {
          logger.info('');
          await progressTracker.displayStatus();
        }
      } catch (error) {
        logger.error(`Failed to get status: ${error.message}`);
        process.exit(1);
      }
    });
}
