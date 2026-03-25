// -------- Verify Single Project --------

import logger from '../../../utils/logger.js';
import { queueProjectChecks } from './run-project-checks.js';

/** Run all checks for a single project. */
export async function verifySingleProject(params) {
  const { project, idx, total, org, sonarqubeConfig, rateLimitConfig, scProjectKeys, shouldRun, perfConfig, SonarQubeClient, SonarCloudClient } = params;
  logger.info(`\n--- Project ${idx + 1}/${total}: ${project.key} ---`);

  const scClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, rateLimit: rateLimitConfig,
  });

  // Resolve SC project key
  let scProjectKey = project.key;
  const globalCheck = await scClient.isProjectKeyTakenGlobally(project.key);
  if (globalCheck.taken && globalCheck.owner !== org.key) scProjectKey = `${org.key}_${project.key}`;

  const projectResult = { sqProjectKey: project.key, scProjectKey, checks: {} };
  const exists = scProjectKeys.has(scProjectKey) || await scClient.projectExists(scProjectKey);
  projectResult.checks.existence = { status: exists ? 'pass' : 'fail' };

  if (!exists) {
    logger.warn(`Project ${scProjectKey} not found in SonarCloud — skipping all checks`);
    return projectResult;
  }

  const projectSqClient = new SonarQubeClient({
    url: sonarqubeConfig.url, token: sonarqubeConfig.token, projectKey: project.key,
  });
  const projectScClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io', token: org.token,
    organization: org.key, projectKey: scProjectKey, rateLimit: rateLimitConfig,
  });

  const checks = queueProjectChecks(projectSqClient, projectScClient, project.key, scProjectKey, projectResult, shouldRun, perfConfig);
  await Promise.all(checks);
  return projectResult;
}
