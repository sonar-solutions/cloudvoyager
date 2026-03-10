import { loadConfig, requireProjectKeys } from '../config/loader.js';
import { transferProject } from '../transfer-pipeline.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../utils/concurrency.js';
import logger, { enableFileLogging } from '../utils/logger.js';
import { CloudVoyagerError, GracefulShutdownError } from '../utils/errors.js';
import { ShutdownCoordinator } from '../utils/shutdown.js';
import { ProgressTracker } from '../utils/progress.js';

export function registerTransferCommand(program) {
  program
    .command('transfer')
    .description('Transfer data from SonarQube to SonarCloud')
    .requiredOption('-c, --config <path>', 'Path to configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--wait', 'Wait for analysis to complete before returning')
    .option('--concurrency <n>', 'Override max concurrency for I/O operations', Number.parseInt)
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
        enableFileLogging('transfer');

        const config = await loadConfig(options.config);
        requireProjectKeys(config);

        // Handle --show-progress: display checkpoint status and exit
        if (options.showProgress) {
          const stateFile = config.transfer?.stateFile || './.cloudvoyager-state.json';
          const progressTracker = new ProgressTracker(stateFile);
          await progressTracker.displayStatus();
          return;
        }

        logger.info('=== CloudVoyager Migration ===');
        logger.info('Starting data transfer from SonarQube to SonarCloud...');

        const transferConfig = config.transfer || {};
        if (options.skipAllBranchSync) transferConfig.syncAllBranches = false;

        const perfConfig = resolvePerformanceConfig({
          ...config.performance,
          ...(options.autoTune && { autoTune: true }),
          ...(options.concurrency && { maxConcurrency: options.concurrency, sourceExtraction: { concurrency: options.concurrency }, hotspotExtraction: { concurrency: options.concurrency } }),
          ...(options.maxMemory && { maxMemoryMB: options.maxMemory }),
          ...(options.workers && { workerThreads: options.workers })
        });
        ensureHeapSize(perfConfig.maxMemoryMB);
        logSystemInfo(perfConfig);

        await transferProject({
          sonarqubeConfig: config.sonarqube,
          sonarcloudConfig: config.sonarcloud,
          transferConfig,
          performanceConfig: perfConfig,
          wait: options.wait || false,
          shutdownCoordinator,
          forceRestart: options.forceRestart || false,
          forceFreshExtract: options.forceFreshExtract || false,
          forceUnlock: options.forceUnlock || false
        });

        logger.info('=== Transfer completed successfully ===');
      } catch (error) {
        if (error instanceof GracefulShutdownError) {
          logger.info('Transfer interrupted gracefully. Resume by running the same command again.');
          process.exit(0);
        } else if (error instanceof CloudVoyagerError) {
          logger.error(`Transfer failed: ${error.message}`);
        } else {
          logger.error(`Unexpected error: ${error.message}`);
          logger.debug(error.stack);
        }
        process.exit(1);
      }
    });
}
