import { loadConfig, requireProjectKeys } from '../shared/config/loader.js';
import { detectAndRoute } from '../version-router.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../shared/utils/concurrency.js';
import logger, { enableFileLogging } from '../shared/utils/logger.js';
import { CloudVoyagerError, GracefulShutdownError } from '../shared/utils/errors.js';
import { ShutdownCoordinator } from '../shared/utils/shutdown.js';
import { ProgressTracker } from '../shared/utils/progress.js';

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
        });
        ensureHeapSize(perfConfig.maxMemoryMB);
        logSystemInfo(perfConfig);

        const { transferProject, pipelineId } = await detectAndRoute(config.sonarqube);
        logger.info(`Using pipeline: ${pipelineId}`);

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
        process.exit(0);
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
