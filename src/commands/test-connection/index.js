// -------- Test Connection Command --------

import { readFile } from 'node:fs/promises';
import { loadConfig } from '../../shared/config/loader.js';
import { loadMigrateConfig } from '../../shared/config/loader-migrate.js';
import { detectAndRoute } from '../../version-router.js';
import logger from '../../shared/utils/logger.js';

export function registerTestCommand(program) {
  program
    .command('test')
    .description('Test connections to SonarQube and SonarCloud')
    .requiredOption('-c, --config <path>', 'Path to configuration file')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (options) => {
      try {
        if (options.verbose) logger.level = 'debug';
        logger.info('Testing connections...');

        // Pre-inspect the raw config to determine which loader to use
        const rawContent = await readFile(options.config, 'utf-8');
        const rawConfig = JSON.parse(rawContent);
        const isMigrateConfig = rawConfig.sonarcloud && Array.isArray(rawConfig.sonarcloud.organizations);

        const config = isMigrateConfig
          ? await loadMigrateConfig(options.config)
          : await loadConfig(options.config);

        const { pipelineId, parsedVersion } = await detectAndRoute(config.sonarqube);
        logger.info(`SonarQube version: ${parsedVersion.raw} → pipeline: ${pipelineId}`);

        const VALID_PIPELINES = new Set(['sq-9.9', 'sq-10.0', 'sq-10.4', 'sq-2025']);
        if (!VALID_PIPELINES.has(pipelineId)) {
          throw new Error(`Unsupported pipeline: ${pipelineId}`);
        }

        const { SonarQubeClient } = await import(`../../pipelines/${pipelineId}/sonarqube/api-client.js`);
        const { SonarCloudClient } = await import(`../../pipelines/${pipelineId}/sonarcloud/api-client.js`);

        logger.info('Testing SonarQube connection...');
        const sonarQubeClient = new SonarQubeClient(config.sonarqube);
        await sonarQubeClient.testConnection();
        logger.info('SonarQube connection successful');

        logger.info('Testing SonarCloud connection...');
        // Support both transfer (single-org) and migrate (multi-org) config formats
        const scConfig = config.sonarcloud.organizations
          ? {  // migrate-config.json format: extract first org
              url: config.sonarcloud.organizations[0].url || 'https://sonarcloud.io',
              token: config.sonarcloud.organizations[0].token,
              tokens: config.sonarcloud.organizations[0].tokens,
              organization: config.sonarcloud.organizations[0].key,
              rateLimit: config.rateLimit,
            }
          : {  // transfer-config.json format: use directly
              ...config.sonarcloud,
              rateLimit: config.rateLimit,
            };
        const sonarCloudClient = new SonarCloudClient(scConfig);
        await sonarCloudClient.testConnection();
        logger.info('SonarCloud connection successful');
        logger.info('All connections tested successfully!');
      } catch (error) {
        logger.error(`Connection test failed: ${error.message}`);
        process.exit(1);
      }
    });
}
