// -------- Paginated GET Helper --------

/** Generic paginated GET helper. */
export async function getPaginated(client, endpoint, params = {}, dataKey = 'components') {
  let allResults = [];
  let page = 1;
  const pageSize = params.ps || 500;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get(endpoint, { params: { ...params, p: page, ps: pageSize } });
    const results = response.data[dataKey] || [];
    allResults = allResults.concat(results);
    const total = response.data.paging?.total || response.data.total || 0;
    if (page * pageSize >= total || results.length < pageSize) break;
    page++;
  }
  return allResults;
}
