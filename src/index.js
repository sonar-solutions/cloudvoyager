#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { loadConfig, requireProjectKeys } from './config/loader.js';
import { VersionAwareSonarQubeClient as SonarQubeClient } from './sonarqube/version-aware-client.js';
import { SonarCloudClient } from './sonarcloud/api-client.js';
import { StateTracker } from './state/tracker.js';
import logger from './utils/logger.js';
import { registerTransferCommand } from './commands/transfer.js';
import { registerMigrateCommand } from './commands/migrate.js';
import { registerSyncMetadataCommand } from './commands/sync-metadata.js';
import { registerVerifyCommand } from './commands/verify.js';
import { ProgressTracker } from './utils/progress.js';

const program = new Command();

program
  .name('cloudvoyager')
  .description('CloudVoyager CLI — Migrate data from SonarQube to SonarCloud')
  .version('1.0.0');

registerTransferCommand(program);
registerMigrateCommand(program);
registerSyncMetadataCommand(program);
registerVerifyCommand(program);

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
      if (error.errors) error.errors.forEach(err => logger.error(`  - ${err}`));
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Show current synchronization status')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      const stateFile = config.transfer?.stateFile || './.cloudvoyager-state.json';
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

      // Show checkpoint journal status if it exists
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

program
  .command('reset')
  .description('Reset state and clear sync history')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .option('-y, --yes', 'Skip confirmation prompt')
  .action(async (options) => {
    try {
      const config = await loadConfig(options.config);
      if (!options.yes) {
        logger.warn('This will clear all sync state, checkpoint journals, and extraction caches.');
        logger.warn('The next transfer will be a full sync from scratch.');
        logger.warn('Re-run with --yes to proceed with the reset.');
        process.exit(0);
      }
      const stateFile = config.transfer?.stateFile || './.cloudvoyager-state.json';
      const stateTracker = new StateTracker(stateFile);
      await stateTracker.reset();
      logger.info('State file reset successfully');

      // Clear checkpoint journal files
      const journalPath = `${stateFile}.journal`;
      for (const suffix of ['', '.backup', '.tmp']) {
        const f = `${journalPath}${suffix}`;
        if (existsSync(f)) {
          await rm(f, { force: true });
          logger.info(`Removed checkpoint journal: ${f}`);
        }
      }

      // Clear lock file
      const lockPath = `${stateFile}.lock`;
      if (existsSync(lockPath)) {
        await rm(lockPath, { force: true });
        logger.info(`Removed lock file: ${lockPath}`);
      }

      // Clear extraction cache directory
      const cacheDir = join(dirname(stateFile), '.cache');
      if (existsSync(cacheDir)) {
        await rm(cacheDir, { recursive: true, force: true });
        logger.info(`Removed extraction cache: ${cacheDir}`);
      }

      logger.info('Full reset complete — all state, journals, and caches cleared');
    } catch (error) {
      logger.error(`Failed to reset state: ${error.message}`);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test connections to SonarQube and SonarCloud')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (options) => {
    try {
      if (options.verbose) logger.level = 'debug';
      logger.info('Testing connections...');
      const config = await loadConfig(options.config);
      logger.info('Testing SonarQube connection...');
      const sonarQubeClient = new SonarQubeClient(config.sonarqube);
      await sonarQubeClient.testConnection();
      logger.info('SonarQube connection successful');
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

program.parse();
