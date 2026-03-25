import logger from '../../../../../../shared/utils/logger.js';

// -------- Configuration --------

// SonarCloud only accepts the classic issue statuses for the `statuses` parameter.
const ALL_STATUSES = 'OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED';

// -------- Main Logic --------

// Search for issues in a SonarCloud project with pagination.
export async function searchIssues(client, organization, projectKey, filters = {}) {
  logger.debug(`Searching issues in project: ${projectKey}`);

  let allResults = [];
  let page = 1;
  const pageSize = 500;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get('/api/issues/search', {
      params: {
        componentKeys: projectKey,
        organization,
        statuses: ALL_STATUSES,
        ps: pageSize,
        p: page,
        ...filters
      }
    });

    const issues = response.data.issues || [];
    allResults = allResults.concat(issues);

    const total = response.data.paging?.total || 0;
    if (page * pageSize >= total || issues.length < pageSize) break;
    page++;
  }

  return allResults;
}
