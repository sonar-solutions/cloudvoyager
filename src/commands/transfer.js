import { loadConfig, requireProjectKeys } from '../config/loader.js';
import { transferProject } from '../transfer-pipeline.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../utils/concurrency.js';
import logger from '../utils/logger.js';
import { CloudVoyagerError } from '../utils/errors.js';

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
    .action(async (options) => {
      try {
        if (options.verbose) logger.level = 'debug';

        logger.info('=== CloudVoyager Migration ===');
        logger.info('Starting data transfer from SonarQube to SonarCloud...');

        const config = await loadConfig(options.config);
        requireProjectKeys(config);

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
          transferConfig: config.transfer,
          performanceConfig: perfConfig,
          wait: options.wait || false
        });

        logger.info('=== Transfer completed successfully ===');
      } catch (error) {
        if (error instanceof CloudVoyagerError) {
          logger.error(`Transfer failed: ${error.message}`);
        } else {
          logger.error(`Unexpected error: ${error.message}`);
          logger.debug(error.stack);
        }
        process.exit(1);
      }
    });
}
