#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, requireProjectKeys } from './config/loader.js';
import { SonarQubeClient } from './sonarqube/api-client.js';
import { SonarCloudClient } from './sonarcloud/api-client.js';
import { StateTracker } from './state/tracker.js';
import logger from './utils/logger.js';
import { registerTransferCommand } from './commands/transfer.js';
import { registerTransferAllCommand } from './commands/transfer-all.js';
import { registerMigrateCommand } from './commands/migrate.js';
import { registerSyncMetadataCommand } from './commands/sync-metadata.js';

const program = new Command();

program
  .name('cloudvoyager')
  .description('Migrate data from SonarQube to SonarCloud')
  .version('1.0.0');

registerTransferCommand(program);
registerTransferAllCommand(program);
registerMigrateCommand(program);
registerSyncMetadataCommand(program);

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
      const stateTracker = new StateTracker(config.transfer.stateFile);
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

program
  .command('test')
  .description('Test connections to SonarQube and SonarCloud')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .action(async (options) => {
    try {
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
