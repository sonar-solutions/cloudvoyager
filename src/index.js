#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, loadMigrateConfig, requireProjectKeys } from './config/loader.js';
import { SonarQubeClient } from './sonarqube/api-client.js';
import { SonarCloudClient } from './sonarcloud/api-client.js';
import { StateTracker } from './state/tracker.js';
import { transferProject } from './transfer-pipeline.js';
import { migrateAll } from './migrate-pipeline.js';
import { resolvePerformanceConfig, logSystemInfo, ensureHeapSize } from './utils/concurrency.js';
import logger from './utils/logger.js';
import { CloudVoyagerError } from './utils/errors.js';

const program = new Command();

program
  .name('cloudvoyager')
  .description('Migrate data from SonarQube to SonarCloud')
  .version('1.0.0');

/**
 * Transfer command - Single project migration
 */
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
      if (options.verbose) {
        logger.level = 'debug';
      }

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

/**
 * Transfer-all command - Migrate ALL projects from SonarQube to SonarCloud
 */
program
  .command('transfer-all')
  .description('Transfer ALL projects from SonarQube to SonarCloud')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--wait', 'Wait for analysis to complete before returning')
  .option('--dry-run', 'List projects that would be transferred without transferring')
  .option('--concurrency <n>', 'Override max concurrency for I/O operations', Number.parseInt)
  .option('--max-memory <mb>', 'Max heap size in MB (auto-restarts with increased heap if needed)', Number.parseInt)

  .option('--project-concurrency <n>', 'Max concurrent project migrations', Number.parseInt)
  .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
  .action(async (options) => {
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      logger.info('=== CloudVoyager - Transfer All Projects ===');

      const config = await loadConfig(options.config);
      const { projects, projectKeyPrefix, projectKeyMapping } = await discoverProjects(config);

      if (projects.length === 0) {
        logger.warn('No projects to transfer');
        return;
      }

      logProjectList(projects, projectKeyMapping, projectKeyPrefix);

      if (options.dryRun) {
        logger.info('Dry run complete. No projects were transferred.');
        return;
      }

      const perfConfig = resolvePerformanceConfig({
        ...config.performance,
        ...(options.autoTune && { autoTune: true }),
        ...(options.concurrency && { maxConcurrency: options.concurrency, sourceExtraction: { concurrency: options.concurrency }, hotspotExtraction: { concurrency: options.concurrency } }),
        ...(options.maxMemory && { maxMemoryMB: options.maxMemory }),

        ...(options.projectConcurrency && { projectMigration: { concurrency: options.projectConcurrency } })
      });
      ensureHeapSize(perfConfig.maxMemoryMB);
      logSystemInfo(perfConfig);

      const { results, startTime } = await executeTransferAll(projects, config, projectKeyMapping, projectKeyPrefix, options, perfConfig);
      const failedCount = logTransferSummary(results, startTime);

      if (failedCount > 0) {
        process.exit(1);
      }

    } catch (error) {
      if (error instanceof CloudVoyagerError) {
        logger.error(`Transfer-all failed: ${error.message}`);
      } else {
        logger.error(`Unexpected error: ${error.message}`);
        logger.debug(error.stack);
      }
      process.exit(1);
    }
  });

/**
 * Validate command - Validate configuration file
 */
program
  .command('validate')
  .description('Validate configuration file')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      logger.info('Validating configuration...');

      const config = await loadConfig(options.config);
      requireProjectKeys(config);

      logger.info('Configuration is valid!');
      logger.info(`SonarQube: ${config.sonarqube.url}`);
      logger.info(`SonarCloud: ${config.sonarcloud.url}`);
      logger.info(`Project: ${config.sonarqube.projectKey} -> ${config.sonarcloud.projectKey}`);
      logger.info(`Transfer mode: ${config.transfer.mode}`);

    } catch (error) {
      logger.error(`Validation failed: ${error.message}`);
      if (error.errors) {
        error.errors.forEach(err => logger.error(`  - ${err}`));
      }
      process.exit(1);
    }
  });

/**
 * Status command - Show current state
 */
program
  .command('status')
  .description('Show current synchronization status')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);

      const stateTracker = new StateTracker(config.transfer.stateFile);
      await stateTracker.initialize();

      const summary = stateTracker.getSummary();

      logger.info('=== Synchronization Status ===');
      logger.info(`Last sync: ${summary.lastSync || 'Never'}`);
      logger.info(`Processed issues: ${summary.processedIssuesCount}`);
      logger.info(`Completed branches: ${summary.completedBranchesCount}`);

      if (summary.completedBranches.length > 0) {
        logger.info('Branches:');
        summary.completedBranches.forEach(branch => {
          logger.info(`  - ${branch}`);
        });
      }

      logger.info(`Sync history entries: ${summary.syncHistoryCount}`);

    } catch (error) {
      logger.error(`Failed to get status: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Reset command - Clear state and start fresh
 */
program
  .command('reset')
  .description('Reset state and clear sync history')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);

      if (!options.yes) {
        logger.warn('This will clear all sync state and history.');
        logger.warn('The next transfer will be a full sync.');
        logger.warn('Use --yes to skip this confirmation.');
        process.exit(0);
      }

      const stateTracker = new StateTracker(config.transfer.stateFile);
      await stateTracker.reset();

      logger.info('State reset successfully');

    } catch (error) {
      logger.error(`Failed to reset state: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Test command - Test connections to SonarQube and SonarCloud
 */
program
  .command('test')
  .description('Test connections to SonarQube and SonarCloud')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      logger.info('Testing connections...');

      const config = await loadConfig(options.config);

      // Test SonarQube
      logger.info('Testing SonarQube connection...');
      const sonarQubeClient = new SonarQubeClient(config.sonarqube);
      await sonarQubeClient.testConnection();
      logger.info('SonarQube connection successful');

      // Test SonarCloud
      logger.info('Testing SonarCloud connection...');
      const sonarCloudClient = new SonarCloudClient({ ...config.sonarcloud, rateLimit: config.rateLimit });
      await sonarCloudClient.testConnection();
      logger.info('SonarCloud connection successful');

      logger.info('All connections tested successfully!');

    } catch (error) {
      logger.error(`Connection test failed: ${error.message}`);
      process.exit(1);
    }
  });

/**
 * Migrate command - Full multi-org migration (projects, gates, profiles, permissions, etc.)
 */
program
  .command('migrate')
  .description('Full migration from SonarQube to one or more SonarCloud organizations')
  .requiredOption('-c, --config <path>', 'Path to migration configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--wait', 'Wait for analysis to complete before returning')
  .option('--dry-run', 'Extract data and generate mappings without migrating')
  .option('--skip-issue-metadata-sync', 'Skip syncing issue metadata (statuses, assignments, comments, tags)')
  .option('--skip-hotspot-metadata-sync', 'Skip syncing hotspot metadata (statuses, comments)')
  .option('--concurrency <n>', 'Override max concurrency for I/O operations', Number.parseInt)
  .option('--max-memory <mb>', 'Max heap size in MB (auto-restarts with increased heap if needed)', Number.parseInt)

  .option('--project-concurrency <n>', 'Max concurrent project migrations', Number.parseInt)
  .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
  .action(async (options) => {
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      logger.info('=== CloudVoyager - Full Organization Migration ===');

      const config = await loadMigrateConfig(options.config);

      const migrateConfig = config.migrate || {};
      if (options.dryRun) migrateConfig.dryRun = true;
      if (options.skipIssueMetadataSync) migrateConfig.skipIssueMetadataSync = true;
      if (options.skipHotspotMetadataSync) migrateConfig.skipHotspotMetadataSync = true;

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
        migrateConfig,
        transferConfig: config.transfer || { mode: 'full', batchSize: 100 },
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

/**
 * Sync metadata command - Sync only issue/hotspot metadata for already-migrated projects
 */
program
  .command('sync-metadata')
  .description('Sync issue and hotspot metadata (statuses, comments, assignments, tags) for already-migrated projects')
  .requiredOption('-c, --config <path>', 'Path to migration configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--skip-issue-metadata-sync', 'Skip syncing issue metadata (statuses, assignments, comments, tags)')
  .option('--skip-hotspot-metadata-sync', 'Skip syncing hotspot metadata (statuses, comments)')
  .option('--concurrency <n>', 'Override max concurrency for I/O operations', Number.parseInt)
  .option('--max-memory <mb>', 'Max heap size in MB (auto-restarts with increased heap if needed)', Number.parseInt)
  .option('--auto-tune', 'Auto-detect hardware and set optimal performance values')
  .action(async (options) => {
    try {
      if (options.verbose) {
        logger.level = 'debug';
      }

      logger.info('=== CloudVoyager - Issue & Hotspot Metadata Sync ===');

      const config = await loadMigrateConfig(options.config);

      const migrateConfig = config.migrate || {};
      if (options.skipIssueMetadataSync) migrateConfig.skipIssueMetadataSync = true;
      if (options.skipHotspotMetadataSync) migrateConfig.skipHotspotMetadataSync = true;

      const perfConfig = resolvePerformanceConfig({
        ...config.performance,
        ...(options.autoTune && { autoTune: true }),
        ...(options.concurrency && { issueSync: { concurrency: options.concurrency }, hotspotSync: { concurrency: Math.min(options.concurrency, 3) }, hotspotExtraction: { concurrency: options.concurrency } }),
        ...(options.maxMemory && { maxMemoryMB: options.maxMemory })
      });
      ensureHeapSize(perfConfig.maxMemoryMB);
      logSystemInfo(perfConfig);

      // Run full migrate with issue/hotspot transfer skipped (metadata sync only)
      migrateConfig.dryRun = false;
      const results = await migrateAll({
        sonarqubeConfig: config.sonarqube,
        sonarcloudOrgs: config.sonarcloud.organizations,
        migrateConfig,
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

/**
 * Discover and filter projects for transfer-all command
 */
async function discoverProjects(config) {
  const transferAllConfig = config.transferAll || {};
  const projectKeyPrefix = transferAllConfig.projectKeyPrefix || '';
  const projectKeyMapping = transferAllConfig.projectKeyMapping || {};
  const excludeProjects = new Set(transferAllConfig.excludeProjects || []);

  const discoveryClient = new SonarQubeClient({
    url: config.sonarqube.url,
    token: config.sonarqube.token
  });

  await discoveryClient.testConnection();
  const sonarCloudTestClient = new SonarCloudClient({
    url: config.sonarcloud.url || 'https://sonarcloud.io',
    token: config.sonarcloud.token,
    organization: config.sonarcloud.organization,
    rateLimit: config.rateLimit
  });
  await sonarCloudTestClient.testConnection();

  logger.info('Discovering all SonarQube projects...');
  const allProjects = await discoveryClient.listAllProjects();
  logger.info(`Found ${allProjects.length} projects in SonarQube`);

  const projects = allProjects.filter(p => !excludeProjects.has(p.key));
  if (projects.length !== allProjects.length) {
    logger.info(`Excluded ${allProjects.length - projects.length} projects, ${projects.length} remaining`);
  }

  return { projects, projectKeyPrefix, projectKeyMapping };
}

function logProjectList(projects, projectKeyMapping, projectKeyPrefix) {
  logger.info('Projects to transfer:');
  projects.forEach((project, index) => {
    const scKey = projectKeyMapping[project.key] || `${projectKeyPrefix}${project.key}`;
    logger.info(`  ${index + 1}. ${project.key} -> ${scKey} (${project.name})`);
  });
}

async function executeTransferAll(projects, config, projectKeyMapping, projectKeyPrefix, options, perfConfig = {}) {
  const results = [];
  const startTime = Date.now();

  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    const sqProjectKey = project.key;
    const scProjectKey = projectKeyMapping[sqProjectKey] || `${projectKeyPrefix}${sqProjectKey}`;

    const baseStateFile = config.transfer?.stateFile || './.cloudvoyager-state.json';
    const ext = baseStateFile.endsWith('.json') ? '.json' : '';
    const base = ext ? baseStateFile.slice(0, -ext.length) : baseStateFile;
    const perProjectStateFile = `${base}.${sqProjectKey}${ext}`;

    logger.info(`\n========================================`);
    logger.info(`Project ${i + 1}/${projects.length}: ${sqProjectKey}`);
    logger.info(`  SonarCloud key: ${scProjectKey}`);
    logger.info(`  State file: ${perProjectStateFile}`);
    logger.info(`========================================`);

    try {
      const result = await transferProject({
        sonarqubeConfig: {
          url: config.sonarqube.url,
          token: config.sonarqube.token,
          projectKey: sqProjectKey
        },
        sonarcloudConfig: {
          url: config.sonarcloud.url || 'https://sonarcloud.io',
          token: config.sonarcloud.token,
          organization: config.sonarcloud.organization,
          projectKey: scProjectKey,
          rateLimit: config.rateLimit
        },
        transferConfig: {
          mode: config.transfer?.mode || 'incremental',
          stateFile: perProjectStateFile,
          batchSize: config.transfer?.batchSize || 100
        },
        performanceConfig: perfConfig,
        wait: options.wait || false,
        skipConnectionTest: true,
        projectName: project.name
      });

      results.push({ ...result, success: true });
      logger.info(`Project ${sqProjectKey} transferred successfully`);
    } catch (error) {
      logger.error(`Project ${sqProjectKey} FAILED: ${error.message}`);
      if (options.verbose) {
        logger.debug(error.stack);
      }
      results.push({
        projectKey: sqProjectKey,
        sonarCloudProjectKey: scProjectKey,
        success: false,
        error: error.message
      });
    }
  }

  return { results, startTime };
}

function logTransferSummary(results, startTime) {
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const succeeded = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  logger.info('\n=== Transfer All Summary ===');
  logger.info(`Total projects: ${results.length}`);
  logger.info(`Succeeded: ${succeeded.length}`);
  logger.info(`Failed: ${failed.length}`);
  logger.info(`Duration: ${duration}s`);

  if (succeeded.length > 0) {
    logger.info('\nSuccessful transfers:');
    succeeded.forEach(r => {
      logger.info(`  ${r.projectKey} -> ${r.sonarCloudProjectKey} (${r.stats.issuesTransferred} issues, ${r.stats.componentsTransferred} components, ${r.stats.sourcesTransferred} sources)`);
    });
  }

  if (failed.length > 0) {
    logger.info('\nFailed transfers:');
    failed.forEach(r => {
      logger.error(`  ${r.projectKey}: ${r.error}`);
    });
  }

  logger.info('=== Transfer All Complete ===');
  return failed.length;
}

// Parse command line arguments
program.parse();
