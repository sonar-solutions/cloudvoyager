import logger from '../../../../../shared/utils/logger.js';

// -------- Get Paginated --------

/** Fetch all pages from a paginated SonarQube API endpoint. */
export async function getPaginated(client, endpoint, params = {}, dataKey = 'components') {
  let allResults = [];
  let page = 1;
  const pageSize = params.ps || 500;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    logger.debug(`Fetching ${endpoint} - page ${page}`);
    const response = await client.get(endpoint, { params: { ...params, p: page, ps: pageSize } });
    const results = response.data[dataKey] || [];
    allResults = allResults.concat(results);
    const total = response.data.paging?.total ?? response.data.total ?? 0;
    logger.debug(`Fetched ${allResults.length}/${total} items from ${endpoint}`);
    if (page * pageSize >= total || results.length < pageSize) break;
    page++;
  }

  logger.info(`Retrieved ${allResults.length} items from ${endpoint}`);
  return allResults;
}
