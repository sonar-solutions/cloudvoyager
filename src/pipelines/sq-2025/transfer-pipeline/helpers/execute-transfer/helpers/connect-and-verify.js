import { SonarQubeClient } from '../../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../../sonarcloud/api-client.js';
import logger from '../../../../../../shared/utils/logger.js';

// -------- Connect and Verify --------

/** Create clients, test connections, get server version. */
export async function connectAndVerify(sonarqubeConfig, sonarcloudConfig, skipConnectionTest) {
  const sonarQubeClient = new SonarQubeClient(sonarqubeConfig);
  const sonarCloudClient = new SonarCloudClient(sonarcloudConfig);

  if (!skipConnectionTest) {
    await sonarQubeClient.testConnection();
    await sonarCloudClient.testConnection();
  }

  const sqVersionRaw = await sonarQubeClient.getServerVersion();
  logger.info(`SonarQube version: ${sqVersionRaw}`);

  return { sonarQubeClient, sonarCloudClient, sqVersionRaw };
}
