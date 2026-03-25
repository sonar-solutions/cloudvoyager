// -------- Validate Command --------

import { loadConfig, requireProjectKeys } from '../../shared/config/loader.js';
import logger from '../../shared/utils/logger.js';

export function registerValidateCommand(program) {
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
}
