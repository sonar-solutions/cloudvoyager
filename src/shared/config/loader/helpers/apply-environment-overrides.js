// -------- Apply Environment Overrides --------
import logger from '../../../utils/logger.js';

export function applyEnvironmentOverrides(config) {
  if (config.sonarqube && process.env.SONARQUBE_TOKEN) {
    config.sonarqube.token = process.env.SONARQUBE_TOKEN;
    logger.debug('Overriding SonarQube token from environment variable');
  }
  if (config.sonarcloud && process.env.SONARCLOUD_TOKEN) {
    config.sonarcloud.token = process.env.SONARCLOUD_TOKEN;
    logger.debug('Overriding SonarCloud token from environment variable');
  }
  if (config.sonarqube && process.env.SONARQUBE_URL) {
    config.sonarqube.url = process.env.SONARQUBE_URL;
    logger.debug('Overriding SonarQube URL from environment variable');
  }
  if (config.sonarcloud && process.env.SONARCLOUD_URL) {
    config.sonarcloud.url = process.env.SONARCLOUD_URL;
    logger.debug('Overriding SonarCloud URL from environment variable');
  }
}
