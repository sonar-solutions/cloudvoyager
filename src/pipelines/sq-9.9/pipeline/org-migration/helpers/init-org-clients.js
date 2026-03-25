import { SonarQubeClient } from '../../../sonarqube/api-client.js';
import { SonarCloudClient } from '../../../sonarcloud/api-client.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Initialize SQ + SC Clients and Test Connection --------

export async function initOrgClients(org, orgResult, ctx) {
  const scClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io', token: org.token,
    organization: org.key, rateLimit: ctx.rateLimitConfig,
  });

  try {
    await scClient.testConnection();
    orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'success' });
  } catch (error) {
    orgResult.steps.push({ step: 'Connect to SonarCloud', status: 'failed', error: error.message });
    logger.error(`Failed to connect to SonarCloud org ${org.key}: ${error.message}`);
    return null;
  }

  const sqClient = new SonarQubeClient({ url: ctx.sonarqubeConfig.url, token: ctx.sonarqubeConfig.token });
  return { scClient, sqClient };
}
