// -------- Run Pipeline Steps --------

import { detectAndRoute } from '../../../../version-router.js';
import { mapProjectsToOrganizations } from '../../../mapping/org-mapper.js';
import { verifyPortfolios } from '../../checkers/portfolios.js';
import { safeCheck } from './safe-check.js';
import { fetchProjectBindings } from './fetch-project-bindings.js';
import { verifyOrganization } from './verify-organization.js';

/**
 * Execute the core pipeline steps (connect, discover, verify).
 */
export async function runPipelineSteps(results, sonarqubeConfig, sonarcloudOrgs, rateLimitConfig, perfConfig, shouldRun) {
  const { pipelineId } = await detectAndRoute(sonarqubeConfig);
  const { SonarQubeClient } = await import(`../../../../pipelines/${pipelineId}/sonarqube/api-client.js`);
  const { SonarCloudClient } = await import(`../../../../pipelines/${pipelineId}/sonarcloud/api-client.js`);

  const sqClient = new SonarQubeClient({ url: sonarqubeConfig.url, token: sonarqubeConfig.token });
  await sqClient.testConnection();

  const allProjects = await sqClient.listAllProjects();
  const projectBindings = await fetchProjectBindings(sqClient, allProjects);
  const orgMapping = mapProjectsToOrganizations(allProjects, projectBindings, sonarcloudOrgs);

  for (const assignment of orgMapping.orgAssignments) {
    await verifyOrganization({
      assignment, results, sonarqubeConfig, rateLimitConfig,
      perfConfig, shouldRun, SonarQubeClient, SonarCloudClient,
    });
  }

  if (shouldRun('portfolios')) {
    results.portfolios = await safeCheck(() => verifyPortfolios(sqClient));
  }
}
