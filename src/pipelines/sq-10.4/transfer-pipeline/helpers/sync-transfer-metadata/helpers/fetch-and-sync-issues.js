import logger from '../../../../../../shared/utils/logger.js';
import { syncIssues } from '../../../../sonarcloud/migrators/issue-sync.js';

// -------- Fetch SQ Issues and Sync Metadata to SC --------

/** Fetch issues with comments from SQ and sync metadata to SC. */
export async function fetchAndSyncIssues(opts) {
  const { sonarQubeClient, sonarCloudClient, projectKey,
    performanceConfig = {} } = opts;

  const concurrency = performanceConfig?.issueSync?.concurrency || 5;

  logger.info('Fetching SonarQube issues with comments...');
  const sqIssues = await sonarQubeClient.getIssuesWithComments();
  logger.info(`Fetched ${sqIssues.length} SonarQube issues`);

  if (sqIssues.length === 0) {
    logger.info('No issues to sync');
    return null;
  }

  return syncIssues(projectKey, sqIssues, sonarCloudClient, {
    concurrency, sqClient: sonarQubeClient,
  });
}
