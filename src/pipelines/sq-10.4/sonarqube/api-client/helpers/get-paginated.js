import logger from '../../../../../shared/utils/logger.js';

// -------- Main Logic --------

// Fetch paginated results from a SonarQube API endpoint.
export async function getPaginated(client, endpoint, params = {}, dataKey = 'components') {
  let allResults = [], page = 1;
  const pageSize = params.ps || 500;
  while (true) { // eslint-disable-line no-constant-condition
    logger.debug(`Fetching ${endpoint} - page ${page}`);
    const response = await client.get(endpoint, { params: { ...params, p: page, ps: pageSize } });
    const data = response.data;
    const results = data[dataKey] || [];
    allResults = allResults.concat(results);
    const total = data.paging?.total ?? data.total ?? 0;
    logger.debug(`Fetched ${allResults.length}/${total} items from ${endpoint}`);
    if (page * pageSize >= total || results.length < pageSize) break;
    page++;
  }
  logger.info(`Retrieved ${allResults.length} items from ${endpoint}`);
  return allResults;
}
