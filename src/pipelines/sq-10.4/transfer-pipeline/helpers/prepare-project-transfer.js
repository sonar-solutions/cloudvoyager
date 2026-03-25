import { SonarQubeClient } from '../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../sonarcloud/api-client.js';
import { checkShutdown } from '../../../../shared/utils/shutdown.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Main Logic --------

/**
 * Create API clients, test connections, initialize journal, and ensure project exists.
 *
 * @param {object} opts - Options
 * @returns {Promise<{ sonarQubeClient, sonarCloudClient }>}
 */
export async function prepareProjectTransfer(opts) {
  const { sonarqubeConfig, sonarcloudConfig, skipConnectionTest, journal, projectKey, shutdownCheck, projectName: inputProjectName } = opts;

  const sonarQubeClient = new SonarQubeClient(sonarqubeConfig);
  const sonarCloudClient = new SonarCloudClient(sonarcloudConfig);

  if (!skipConnectionTest) {
    await sonarQubeClient.testConnection();
    await sonarCloudClient.testConnection();
  }

  if (journal) {
    const isResume = await journal.initialize({
      sonarQubeVersion: '10.4+', sonarQubeUrl: sonarqubeConfig.url,
      projectKey, cloudvoyagerVersion: process.env.npm_package_version || 'dev',
    });
    if (isResume) {
      logger.info('=== RESUMING FROM CHECKPOINT ===');
      const exists = await sonarCloudClient.projectExists?.() ?? true;
      if (!exists) throw new Error(`SonarCloud project ${sonarcloudConfig.projectKey} no longer exists. Cannot resume.`);
    }
  }

  checkShutdown(shutdownCheck);

  let projectName = inputProjectName;
  if (!projectName) {
    try { projectName = (await sonarQubeClient.getProject()).name || null; }
    catch (error) { logger.warn(`Could not fetch project name: ${error.message}`); }
  }

  await sonarCloudClient.ensureProject(projectName);

  return { sonarQubeClient, sonarCloudClient, projectName };
}
