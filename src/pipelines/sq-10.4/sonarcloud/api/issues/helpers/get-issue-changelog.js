import logger from '../../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch the changelog for a specific issue from SonarCloud.
export async function getIssueChangelog(client, issueKey) {
  logger.debug(`Fetching changelog for issue: ${issueKey}`);
  const response = await client.get('/api/issues/changelog', { params: { issue: issueKey } });
  return response.data.changelog || [];
}
