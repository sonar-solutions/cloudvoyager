// -------- Test Connection Command --------

import { loadConfig } from '../../shared/config/loader.js';
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
        const config = await loadConfig(options.config);

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
        const sonarCloudClient = new SonarCloudClient({ ...config.sonarcloud, rateLimit: config.rateLimit });
        await sonarCloudClient.testConnection();
        logger.info('SonarCloud connection successful');
        logger.info('All connections tested successfully!');
      } catch (error) {
        logger.error(`Connection test failed: ${error.message}`);
        process.exit(1);
      }
    });
}
