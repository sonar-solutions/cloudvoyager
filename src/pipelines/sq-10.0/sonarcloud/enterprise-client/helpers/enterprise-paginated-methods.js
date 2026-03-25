import logger from '../../../../../shared/utils/logger.js';

// -------- Enterprise Paginated Methods --------

export function bindEnterprisePaginatedMethods(ctx) {
  ctx.listPortfolios = async (enterpriseId, pageSize = 50) => {
    return await paginateEnterprise(ctx.client, '/portfolios', { enterpriseId, pageSize }, 'portfolios');
  };

  ctx.getSelectableOrganizations = async (portfolioId, pageSize = 50) => {
    return await paginateEnterprise(ctx.client, '/portfolio-organizations', { portfolioId, pageSize }, 'organizations');
  };

  ctx.getSelectableProjects = async (portfolioId, organizationId, pageSize = 50) => {
    return await paginateEnterprise(ctx.client, '/portfolio-projects', { portfolioId, organizationId, pageSize }, 'projects');
  };
}

async function paginateEnterprise(client, path, params, dataKey) {
  const items = [];
  let pageIndex = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await client.get(path, { params: { ...params, pageIndex } });
    const page = response.data;
    items.push(...(page[dataKey] || []));
    if (items.length >= (page.page?.total || 0)) break;
    pageIndex++;
  }
  return items;
}
