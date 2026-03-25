// -------- Paginated Enterprise Methods --------

/** Attach paginated list methods to the enterprise client instance. */
export function attachPaginatedMethods(inst) {
  inst.listPortfolios = async (enterpriseId, pageSize = 50) => {
    return paginateV2(inst.client, '/portfolios', { enterpriseId, pageSize }, 'portfolios');
  };

  inst.getSelectableOrganizations = async (portfolioId, pageSize = 50) => {
    return paginateV2(inst.client, '/portfolio-organizations', { portfolioId, pageSize }, 'organizations');
  };

  inst.getSelectableProjects = async (portfolioId, organizationId, pageSize = 50) => {
    return paginateV2(inst.client, '/portfolio-projects', { portfolioId, organizationId, pageSize }, 'projects');
  };
}

async function paginateV2(client, endpoint, params, dataKey) {
  const allItems = [];
  let pageIndex = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get(endpoint, { params: { ...params, pageIndex } });
    const items = response.data[dataKey] || [];
    allItems.push(...items);
    if (items.length < (params.pageSize || 50)) break;
    pageIndex++;
  }
  return allItems;
}
