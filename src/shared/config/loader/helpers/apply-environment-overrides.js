// -------- Apply Environment Overrides --------
import logger from '../../../utils/logger.js';

/**
 * Parse a multi-token environment variable value.
 * Supports JSON array strings: '["token1","token2"]'
 * and comma-separated strings: 'token1,token2,token3'
 */
function parseMultiToken(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.split(',').map(t => t.trim()).filter(Boolean);
    }
  }
  return trimmed.split(',').map(t => t.trim()).filter(Boolean);
}

export function applyEnvironmentOverrides(config) {
  if (config.sonarqube && process.env.SONARQUBE_TOKEN) {
    config.sonarqube.token = process.env.SONARQUBE_TOKEN;
    logger.debug('Overriding SonarQube token from environment variable');
  }
  if (config.sonarcloud) {
    if (process.env.SONARCLOUD_TOKENS) {
      const tokens = parseMultiToken(process.env.SONARCLOUD_TOKENS);
      if (tokens.length > 0) {
        config.sonarcloud.tokens = tokens;
        logger.debug(`Overriding SonarCloud tokens from environment variable (${tokens.length} tokens)`);
      }
    } else if (process.env.SONARCLOUD_TOKEN) {
      config.sonarcloud.token = process.env.SONARCLOUD_TOKEN;
      logger.debug('Overriding SonarCloud token from environment variable');
    }
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
