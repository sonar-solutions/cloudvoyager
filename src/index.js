#!/usr/bin/env node

import { Command } from 'commander';
import { loadConfig, validateConfig } from './config/loader.js';
import { SonarQubeClient } from './sonarqube/api-client.js';
import { SonarCloudClient } from './sonarcloud/api-client.js';
import { DataExtractor } from './sonarqube/extractors/index.js';
import { ProtobufBuilder } from './protobuf/builder.js';
import { ProtobufEncoder } from './protobuf/encoder.js';
import { ReportUploader } from './sonarcloud/uploader.js';
import { StateTracker } from './state/tracker.js';
import logger from './utils/logger.js';
import { SeawhaleError } from './utils/errors.js';

const program = new Command();

program
  .name('seawhale')
  .description('Migrate data from SonarQube to SonarCloud')
  .version('1.0.0');

/**
 * Transfer command - Main migration operation
 */
program
  .command('transfer')
  .description('Transfer data from SonarQube to SonarCloud')
  .requiredOption('-c, --config <path>', 'Path to configuration file')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--no-wait', 'Do not wait for analysis to complete')
  .action(async (options) => {
    try {
      // Set log level
      if (options.verbose) {
        logger.level = 'debug';
      }

      logger.info('=== Seawhale to Skywhale Migration ===');
      logger.info('Starting data transfer from SonarQube to SonarCloud...');

      // Load configuration
      const config = await loadConfig(options.config);

      // Initialize state tracker
      const stateTracker = new StateTracker(config.transfer.stateFile);
      await stateTracker.initialize();

      // Log state info
      const stateSummary = stateTracker.getSummary();
      if (stateSummary.lastSync) {
        logger.info(`Last sync: ${stateSummary.lastSync}`);
        logger.info(`Previously processed: ${stateSummary.processedIssuesCount} issues`);
      }

      // Create API clients
      logger.info('Initializing API clients...');
      const sonarQubeClient = new SonarQubeClient(config.sonarqube);
      const sonarCloudClient = new SonarCloudClient(config.sonarcloud);

      // Test connections
      await sonarQubeClient.testConnection();
      await sonarCloudClient.testConnection();

      // Extract data from SonarQube
      logger.info('Starting data extraction from SonarQube...');
      const extractor = new DataExtractor(
        sonarQubeClient,
        config,
        config.transfer.mode === 'incremental' ? stateTracker : null
      );
      const extractedData = await extractor.extractAll();

      // Fetch SonarCloud quality profiles and branch name for metadata
      logger.info('Fetching SonarCloud quality profiles...');
      const sonarCloudProfiles = await sonarCloudClient.getQualityProfiles();
      const sonarCloudBranchName = await sonarCloudClient.getMainBranchName();

      // Build protobuf messages
      logger.info('Building protobuf messages...');
      const builder = new ProtobufBuilder(extractedData, config.sonarcloud, sonarCloudProfiles, { sonarCloudBranchName });
      const messages = builder.buildAll();

      // Encode to protobuf format
      logger.info('Encoding to protobuf format...');
      const encoder = new ProtobufEncoder();
      const encodedReport = await encoder.encodeAll(messages);

      // Upload to SonarCloud
      logger.info('Uploading to SonarCloud...');
      const uploader = new ReportUploader(sonarCloudClient);

      const metadata = {
        projectKey: config.sonarcloud.projectKey,
        organization: config.sonarcloud.organization,
        version: '1.0.0'
      };

      if (options.wait) {
        // Upload and wait for analysis
        const result = await uploader.uploadAndWait(encodedReport, metadata);
        logger.info('Analysis completed successfully');
      } else {
        // Just upload, don't wait
        const ceTask = await uploader.upload(encodedReport, metadata);
        logger.info(`Upload complete. CE Task ID: ${ceTask.id}`);
        logger.info('Use "seawhale status" to check analysis progress');
      }

      // Record successful transfer in state
      if (config.transfer.mode === 'incremental') {
        await stateTracker.recordTransfer({
          issuesTransferred: extractedData.issues.length,
          componentsTransferred: extractedData.components.length,
          sourcesTransferred: extractedData.sources.length
        });
      }

      logger.info('=== Transfer completed successfully ===');

    } catch (error) {
      if (error instanceof SeawhaleError) {
        logger.error(`Transfer failed: ${error.message}`);
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
      logger.info('✓ SonarQube connection successful');

      // Test SonarCloud
      logger.info('Testing SonarCloud connection...');
      const sonarCloudClient = new SonarCloudClient(config.sonarcloud);
      await sonarCloudClient.testConnection();
      logger.info('✓ SonarCloud connection successful');

      logger.info('All connections tested successfully!');

    } catch (error) {
      logger.error(`Connection test failed: ${error.message}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
