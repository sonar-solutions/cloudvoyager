import { loadMigrateConfig } from '../config/loader.js';
import { migrateAll } from '../migrate-pipeline.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../utils/concurrency.js';
import logger, { enableFileLogging } from '../utils/logger.js';
import { CloudVoyagerError } from '../utils/errors.js';

export function registerSyncMetadataCommand(program) {
  program
    .command('sync-metadata')
    .description('Sync issue and hotspot metadata (statuses, comments, assignments, tags) for already-migrated projects')
    .requiredOption('-c, --config <path>', 'Path to migration configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--skip-issue-metadata-sync', 'Skip syncing issue metadata (statuses, assignments, comments, tags)')
    .option('--skip-hotspot-metadata-sync', 'Skip syncing hotspot metadata (statuses, comments)')
    .option('--skip-quality-profile-sync', 'Skip syncing quality profiles (projects use default SonarCloud profiles)')
    .option('--concurrency <n>', 'Override max concurrency for I/O operations', Number.parseInt)
    .option('--max-memory <mb>', 'Max heap size in MB (auto-restarts with increased heap if needed)', Number.parseInt)
    .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
    .option('--skip-all-branch-sync', 'Only sync the main branch of each project (skip non-main branches)')
    .action(async (options) => {
      try {
        if (options.verbose) logger.level = 'debug';
        enableFileLogging('sync-metadata');
        logger.info('=== CloudVoyager - Issue & Hotspot Metadata Sync ===');

        const config = await loadMigrateConfig(options.config);
        const migrateConfig = config.migrate || {};
        if (options.skipIssueMetadataSync) migrateConfig.skipIssueMetadataSync = true;
        if (options.skipHotspotMetadataSync) migrateConfig.skipHotspotMetadataSync = true;
        if (options.skipQualityProfileSync) migrateConfig.skipQualityProfileSync = true;

        const transferConfig = config.transfer || { mode: 'full', batchSize: 100 };
        if (options.skipAllBranchSync) transferConfig.syncAllBranches = false;

        const perfConfig = resolvePerformanceConfig({
          ...config.performance,
          ...(options.autoTune && { autoTune: true }),
          ...(options.concurrency && { issueSync: { concurrency: options.concurrency }, hotspotSync: { concurrency: Math.min(options.concurrency, 3) }, hotspotExtraction: { concurrency: options.concurrency } }),
          ...(options.maxMemory && { maxMemoryMB: options.maxMemory })
        });
        ensureHeapSize(perfConfig.maxMemoryMB);
        logSystemInfo(perfConfig);

        migrateConfig.dryRun = false;
        const results = await migrateAll({
          sonarqubeConfig: config.sonarqube,
          sonarcloudOrgs: config.sonarcloud.organizations,
          enterpriseConfig: config.sonarcloud.enterprise,
          migrateConfig,
          transferConfig,
          rateLimitConfig: config.rateLimit,
          performanceConfig: perfConfig
        });

        const failed = results.projects.filter(p => !p.success).length;
        if (failed > 0) {
          logger.error(`${failed} project(s) failed metadata sync`);
          process.exit(1);
        }
        logger.info('=== Metadata sync completed successfully ===');
      } catch (error) {
        if (error instanceof CloudVoyagerError) {
          logger.error(`Metadata sync failed: ${error.message}`);
        } else {
          logger.error(`Unexpected error: ${error.message}`);
          logger.debug(error.stack);
        }
        process.exit(1);
      }
    });
}
