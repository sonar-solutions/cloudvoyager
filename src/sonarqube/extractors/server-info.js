import logger from '../../utils/logger.js';

/**
 * Extract server information, plugins, settings, and rules (for documentation only)
 * @param {import('../api-client.js').SonarQubeClient} client
 * @returns {Promise<object>} Server info bundle
 */
export async function extractServerInfo(client) {
  logger.info('Extracting server information...');

  const [systemInfo, plugins, serverWebhooks] = await Promise.all([
    client.getSystemInfo(),
    client.getInstalledPlugins(),
    client.getWebhooks()
  ]);

  // Get server-level settings
  let serverSettings = [];
  try {
    const response = await client.getProjectSettings(null);
    serverSettings = response;
  } catch (error) {
    logger.warn(`Failed to get server settings: ${error.message}`);
  }

  return {
    system: {
      version: systemInfo.System?.Version || systemInfo.version || 'unknown',
      edition: systemInfo.System?.Edition || 'unknown',
      status: systemInfo.status || systemInfo.System?.Status || 'unknown',
      id: systemInfo.System?.['Server ID'] || null,
      database: systemInfo.System?.Database || null
    },
    plugins: plugins.map(p => ({
      key: p.key,
      name: p.name,
      version: p.version,
      description: p.description || ''
    })),
    settings: serverSettings,
    webhooks: serverWebhooks.map(w => ({
      key: w.key,
      name: w.name,
      url: w.url,
      hasSecret: w.hasSecret || false
    }))
  };
}
