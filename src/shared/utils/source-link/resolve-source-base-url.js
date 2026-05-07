import logger from '../logger.js';

const SETTING_KEY = 'sonar.core.serverBaseURL';
const CACHE_PROP = '_resolvedSourceBaseURL';

/**
 * Resolve the source SonarQube base URL to use when building links to source issues/hotspots.
 *
 * Prefers the value of the `sonar.core.serverBaseURL` server setting on the source SQS
 * (e.g. https://sonar.example.com when the server is fronted by a reverse proxy or tunnel),
 * falling back to the URL configured on the sqClient. The resolved value is cached on the
 * client instance so repeated calls within a sync run only hit the API once.
 *
 * Returns the configured baseURL on any error or when the setting is unset/blank.
 */
export async function resolveSourceBaseURL(sqClient) {
  if (!sqClient || !sqClient.baseURL) return null;
  if (sqClient[CACHE_PROP]) return sqClient[CACHE_PROP];

  let resolved = sqClient.baseURL;
  if (typeof sqClient.getServerSettings === 'function') {
    try {
      const settings = await sqClient.getServerSettings();
      const setting = (settings || []).find(s => s && s.key === SETTING_KEY);
      const value = setting && (setting.value || (Array.isArray(setting.values) ? setting.values[0] : null));
      if (value && typeof value === 'string' && value.trim()) {
        resolved = value.trim().replace(/\/+$/, '');
      }
    } catch (error) {
      logger.debug(`Failed to read ${SETTING_KEY} from source SonarQube, falling back to configured URL: ${error.message}`);
    }
  }

  sqClient[CACHE_PROP] = resolved;
  return resolved;
}
