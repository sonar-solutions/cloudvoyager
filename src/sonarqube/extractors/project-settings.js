import logger from '../../utils/logger.js';

/**
 * Extract project-level settings (non-inherited configuration values)
 * @param {import('../api-client.js').SonarQubeClient} client
 * @param {string} [projectKey] - Project key (defaults to client's projectKey)
 * @returns {Promise<Array>} Project settings
 */
export async function extractProjectSettings(client, projectKey = null) {
  const settings = await client.getProjectSettings(projectKey);

  // Filter to only non-inherited, project-level settings
  const projectSettings = settings.filter(s => !s.inherited);
  logger.info(`Found ${projectSettings.length} project-level settings (${settings.length} total including inherited)`);

  return projectSettings.map(s => ({
    key: s.key,
    value: s.value,
    values: s.values || [],
    fieldValues: s.fieldValues || []
  }));
}
