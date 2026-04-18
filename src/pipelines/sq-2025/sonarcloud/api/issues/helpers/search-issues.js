import logger from '../../../../../../shared/utils/logger.js';
import { fetchWithSlicing, createHttpPaginators } from '../../../../../../shared/utils/search-slicer/index.js';

// -------- Search Issues --------

const ALL_STATUSES = 'OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED';

/** Search for all issues in a project, using date-window slicing for >10K results. */
export async function searchIssues(client, organization, projectKey, filters = {}) {
  logger.debug(`Searching issues in project: ${projectKey}`);

  const baseParams = {
    componentKeys: projectKey,
    organization,
    statuses: ALL_STATUSES,
    ...filters,
  };

  const { probeTotalFn, getPaginatedFn } = createHttpPaginators(client);
  return await fetchWithSlicing(probeTotalFn, getPaginatedFn, '/api/issues/search', baseParams, 'issues');
}
