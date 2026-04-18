import logger from '../../../../../../shared/utils/logger.js';
import { fetchWithSlicing } from '../../../../../../shared/utils/search-slicer/index.js';

// -------- Search Issues with Pagination --------

const ALL_STATUSES = 'OPEN,CONFIRMED,REOPENED,RESOLVED,CLOSED';

export async function searchIssues(client, organization, projectKey, filters = {}) {
  logger.debug(`Searching issues in project: ${projectKey}`);

  const baseParams = {
    componentKeys: projectKey,
    organization,
    statuses: ALL_STATUSES,
    ...filters,
  };

  const probeTotalFn = async (endpoint, params) => {
    const response = await client.get(endpoint, { params: { ...params, ps: 1, p: 1 } });
    return response.data.paging?.total ?? 0;
  };

  const getPaginatedFn = async (endpoint, params, dataKey) => {
    let allResults = [];
    let page = 1;
    const pageSize = 500;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const response = await client.get(endpoint, { params: { ...params, ps: pageSize, p: page } });
      const items = response.data[dataKey] || [];
      allResults = allResults.concat(items);
      const total = response.data.paging?.total || 0;
      if (page * pageSize >= total || items.length < pageSize) break;
      page++;
    }
    return allResults;
  };

  return await fetchWithSlicing(probeTotalFn, getPaginatedFn, '/api/issues/search', baseParams, 'issues');
}
