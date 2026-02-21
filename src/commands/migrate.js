import { loadMigrateConfig } from '../config/loader.js';
import { migrateAll } from '../migrate-pipeline.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from '../utils/concurrency.js';
import logger, { enableFileLogging } from '../utils/logger.js';
import { CloudVoyagerError } from '../utils/errors.js';

export const VALID_ONLY_COMPONENTS = [
  'scan-data', 'scan-data-all-branches', 'portfolios', 'quality-gates',
  'quality-profiles', 'permission-templates', 'permissions',
  'issue-metadata', 'hotspot-metadata', 'project-settings'
];

export function registerMigrateCommand(program) {
  program
    .command('migrate')
    .description('Full migration from SonarQube to one or more SonarCloud organizations')
    .requiredOption('-c, --config <path>', 'Path to migration configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('--wait', 'Wait for analysis to complete before returning')
    .option('--dry-run', 'Extract data and generate mappings without migrating')
    .option('--skip-issue-metadata-sync', 'Skip syncing issue metadata (statuses, assignments, comments, tags)')
    .option('--skip-hotspot-metadata-sync', 'Skip syncing hotspot metadata (statuses, comments)')
    .option('--skip-quality-profile-sync', 'Skip syncing quality profiles (projects use default SonarCloud profiles)')
    .option('--only <components>', 'Only migrate specific components (comma-separated): ' + VALID_ONLY_COMPONENTS.join(', '))
    .option('--concurrency <n>', 'Override max concurrency for I/O operations', Number.parseInt)
    .option('--max-memory <mb>', 'Max heap size in MB (auto-restarts with increased heap if needed)', Number.parseInt)
    .option('--project-concurrency <n>', 'Max concurrent project migrations', Number.parseInt)
    .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
    .option('--skip-all-branch-sync', 'Only sync the main branch of each project (skip non-main branches)')
    .action(async (options) => {
      try {
        if (options.verbose) logger.level = 'debug';
        enableFileLogging('migrate');
        logger.info('=== CloudVoyager - Full Organization Migration ===');

        const config = await loadMigrateConfig(options.config);
        const migrateConfig = config.migrate || {};
        if (options.dryRun) migrateConfig.dryRun = true;
        if (options.skipIssueMetadataSync) migrateConfig.skipIssueMetadataSync = true;
        if (options.skipHotspotMetadataSync) migrateConfig.skipHotspotMetadataSync = true;
        if (options.skipQualityProfileSync) migrateConfig.skipQualityProfileSync = true;

        if (options.only) {
          const onlyComponents = options.only.split(',').map(s => s.trim()).filter(Boolean);
          const invalid = onlyComponents.filter(c => !VALID_ONLY_COMPONENTS.includes(c));
          if (invalid.length > 0) {
            logger.error(`Invalid --only component(s): ${invalid.join(', ')}`);
            logger.error(`Valid components: ${VALID_ONLY_COMPONENTS.join(', ')}`);
            process.exit(1);
          }
          if (onlyComponents.length === 0) {
            logger.error('--only requires at least one component');
            process.exit(1);
          }
          migrateConfig.onlyComponents = onlyComponents;
          logger.info(`Selective migration: only migrating [${onlyComponents.join(', ')}]`);
        }

        const transferConfig = config.transfer || { mode: 'full', batchSize: 100 };
        if (options.skipAllBranchSync) transferConfig.syncAllBranches = false;

        const perfConfig = resolvePerformanceConfig({
          ...config.performance,
          ...(options.autoTune && { autoTune: true }),
          ...(options.concurrency && { maxConcurrency: options.concurrency, sourceExtraction: { concurrency: options.concurrency }, hotspotExtraction: { concurrency: options.concurrency }, issueSync: { concurrency: options.concurrency }, hotspotSync: { concurrency: Math.min(options.concurrency, 3) } }),
          ...(options.maxMemory && { maxMemoryMB: options.maxMemory }),
          ...(options.projectConcurrency && { projectMigration: { concurrency: options.projectConcurrency } })
        });
        ensureHeapSize(perfConfig.maxMemoryMB);
        logSystemInfo(perfConfig);

        const results = await migrateAll({
          sonarqubeConfig: config.sonarqube,
          sonarcloudOrgs: config.sonarcloud.organizations,
          enterpriseConfig: config.sonarcloud.enterprise,
          migrateConfig,
          transferConfig,
          rateLimitConfig: config.rateLimit,
          performanceConfig: perfConfig,
          wait: options.wait || false
        });

        const partial = results.projects.filter(p => p.status === 'partial').length;
        const failed = results.projects.filter(p => p.status === 'failed').length;
        if (failed > 0 || partial > 0) {
          logger.error(`${failed} project(s) failed, ${partial} project(s) partially migrated -- see migration report for details`);
          process.exit(1);
        }
        logger.info('=== Migration completed successfully ===');
        process.exit(0);
      } catch (error) {
        if (error instanceof CloudVoyagerError) {
          logger.error(`Migration failed: ${error.message}`);
        } else {
          logger.error(`Unexpected error: ${error.message}`);
          logger.debug(error.stack);
        }
        process.exit(1);
      }
    });
}
