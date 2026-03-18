import { loadMigrateConfig } from '../shared/config/loader.js';
import { verifyAll } from '../shared/verification/verify-pipeline.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../shared/utils/concurrency.js';
import logger, { enableFileLogging } from '../shared/utils/logger.js';
import { CloudVoyagerError } from '../shared/utils/errors.js';

const VALID_ONLY_COMPONENTS = [
  'scan-data', 'scan-data-all-branches', 'portfolios', 'quality-gates',
  'quality-profiles', 'permission-templates', 'permissions',
  'issue-metadata', 'hotspot-metadata', 'project-settings'
];

export function registerVerifyCommand(program) {
  program
    .command('verify')
    .description('Verify migration completeness by comparing SonarQube and SonarCloud data')
    .requiredOption('-c, --config <path>', 'Path to migration configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--only <components>', 'Only verify specific components (comma-separated): ' + VALID_ONLY_COMPONENTS.join(', '))
    .option('--output-dir <path>', 'Output directory for verification reports', './verification-output')
    .option('--concurrency <n>', 'Override max concurrency for I/O operations', (val) => {
      const n = Number.parseInt(val, 10);
      if (Number.isNaN(n) || n < 1) throw new Error(`--concurrency must be a positive integer, got: "${val}"`);
      return n;
    })
    .option('--max-memory <mb>', 'Max heap size in MB', Number.parseInt)
    .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
    .action(async (options) => {
      try {
        if (options.verbose) logger.level = 'debug';
        enableFileLogging('verify');
        logger.info('=== CloudVoyager - Migration Verification ===');

        const config = await loadMigrateConfig(options.config);

        let onlyComponents = null;
        if (options.only) {
          onlyComponents = options.only.split(',').map(s => s.trim()).filter(Boolean);
          const invalid = onlyComponents.filter(c => !VALID_ONLY_COMPONENTS.includes(c));
          if (invalid.length > 0) {
            logger.error(`Invalid --only component(s): ${invalid.join(', ')}`);
            logger.error(`Valid components: ${VALID_ONLY_COMPONENTS.join(', ')}`);
            process.exit(1);
          }
          logger.info(`Selective verification: only checking [${onlyComponents.join(', ')}]`);
        }

        const perfConfig = resolvePerformanceConfig({
          ...config.performance,
          ...(options.autoTune && { autoTune: true }),
          ...(options.concurrency && {
            maxConcurrency: options.concurrency,
            issueSync: { concurrency: options.concurrency },
            hotspotSync: { concurrency: Math.min(options.concurrency, 3) }
          }),
          ...(options.maxMemory && { maxMemoryMB: options.maxMemory })
        });
        ensureHeapSize(perfConfig.maxMemoryMB);
        logSystemInfo(perfConfig);

        const results = await verifyAll({
          sonarqubeConfig: config.sonarqube,
          sonarcloudOrgs: config.sonarcloud.organizations,
          rateLimitConfig: config.rateLimit,
          performanceConfig: perfConfig,
          outputDir: options.outputDir,
          onlyComponents
        });

        if (results.summary.failed > 0 || results.summary.errors > 0) {
          logger.error(`Verification completed with ${results.summary.failed} failures and ${results.summary.errors} errors`);
          process.exit(1);
        }

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
