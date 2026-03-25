// -------- Generic Paginated API Fetcher --------

export async function getPaginated(client, endpoint, params = {}, dataKey = 'components') {
  let allResults = [];
  let page = 1;
  const pageSize = params.ps || 500;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get(endpoint, { params: { ...params, p: page, ps: pageSize } });
    const data = response.data;
    const results = data[dataKey] || [];
    allResults = allResults.concat(results);
    const total = data.paging?.total || data.total || 0;
    if (page * pageSize >= total || results.length < pageSize) break;
    page++;
  }

  return allResults;
}
