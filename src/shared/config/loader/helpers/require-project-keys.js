// -------- Require Project Keys --------
import { ConfigurationError } from '../../../utils/errors.js';

export function requireProjectKeys(config) {
  if (!config.sonarqube.projectKey) throw new ConfigurationError('sonarqube.projectKey is required for this command');
  if (!config.sonarcloud.projectKey) throw new ConfigurationError('sonarcloud.projectKey is required for this command');
}
