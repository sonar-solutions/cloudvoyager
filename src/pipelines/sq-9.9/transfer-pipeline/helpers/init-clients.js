import { SonarQubeClient } from '../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../sonarcloud/api-client.js';
import logger from '../../../../shared/utils/logger.js';

// -------- Initialize API Clients --------

export async function initClients(sonarqubeConfig, sonarcloudConfig, skipConnectionTest) {
  const sonarQubeClient = new SonarQubeClient(sonarqubeConfig);
  const sonarCloudClient = new SonarCloudClient(sonarcloudConfig);

  if (!skipConnectionTest) {
    await sonarQubeClient.testConnection();
    await sonarCloudClient.testConnection();
  }

  logger.info('SonarQube version: 9.9 (hardcoded pipeline)');
  return { sonarQubeClient, sonarCloudClient };
}
