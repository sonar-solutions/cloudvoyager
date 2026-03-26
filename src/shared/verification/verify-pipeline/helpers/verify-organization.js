// -------- Verify Organization --------

import { mapConcurrent } from '../../../utils/concurrency.js';
import logger from '../../../utils/logger.js';
import { runOrgChecks } from './run-org-checks.js';
import { verifySingleProject } from './verify-single-project.js';

/** Run all checks for a single organization and its projects. */
export async function verifyOrganization(params) {
  const { assignment, results, sonarqubeConfig, rateLimitConfig, perfConfig, shouldRun, SonarQubeClient, SonarCloudClient } = params;
  const { org, projects } = assignment;
  if (projects.length === 0) return;

  logger.info('\n========================================');
  logger.info(`=== Verifying organization: ${org.key} (${projects.length} projects) ===`);
  logger.info('========================================');

  const scClient = new SonarCloudClient({
    url: org.url || 'https://sonarcloud.io', token: org.token, organization: org.key, rateLimit: rateLimitConfig,
  });
  try { await scClient.testConnection(); } catch (error) {
    logger.error(`Failed to connect to SC org ${org.key}: ${error.message}`);
    results.orgResults.push({ orgKey: org.key, error: error.message, checks: {} });
    return;
  }

  const sqClient = new SonarQubeClient({ url: sonarqubeConfig.url, token: sonarqubeConfig.token, rateLimit: rateLimitConfig });
  const orgResult = { orgKey: org.key, checks: {} };
  await runOrgChecks(sqClient, scClient, orgResult, shouldRun);
  results.orgResults.push(orgResult);

  const scProjects = await scClient.listProjects();
  const scProjectKeys = new Set(scProjects.map(p => p.key));
  const projectConcurrency = perfConfig.projectVerification?.concurrency || 3;
  const projectResults = await mapConcurrent(projects, async (project, idx) => {
    return verifySingleProject({
      project, idx, total: projects.length, org, sonarqubeConfig, rateLimitConfig,
      scProjectKeys, shouldRun, perfConfig, SonarQubeClient, SonarCloudClient,
    });
  }, { concurrency: projectConcurrency, settled: true });

  for (const r of projectResults) {
    if (r.status === 'fulfilled') results.projectResults.push(r.value);
    else logger.error(`Project verification failed: ${r.reason?.message || r.reason}`);
  }
}
