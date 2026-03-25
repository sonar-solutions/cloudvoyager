// -------- Paginated Enterprise API Fetchers --------

export async function listPortfolios(client, enterpriseId, pageSize = 50) {
  const portfolios = [];
  let pageIndex = 1;
  while (true) {
    const response = await client.get('/portfolios', { params: { enterpriseId, pageSize, pageIndex } });
    const page = response.data;
    portfolios.push(...(page.portfolios || []));
    if (portfolios.length >= (page.page?.total || 0)) break;
    pageIndex++;
  }
  return portfolios;
}

export async function getSelectableOrganizations(client, portfolioId, pageSize = 50) {
  const orgs = [];
  let pageIndex = 1;
  while (true) {
    const response = await client.get('/portfolio-organizations', { params: { portfolioId, pageSize, pageIndex } });
    const page = response.data;
    orgs.push(...(page.organizations || []));
    if (orgs.length >= (page.page?.total || 0)) break;
    pageIndex++;
  }
  return orgs;
}

export async function getSelectableProjects(client, portfolioId, organizationId, pageSize = 50) {
  const projects = [];
  let pageIndex = 1;
  while (true) {
    const response = await client.get('/portfolio-projects', { params: { portfolioId, organizationId, pageSize, pageIndex } });
    const page = response.data;
    projects.push(...(page.projects || []));
    if (projects.length >= (page.page?.total || 0)) break;
    pageIndex++;
  }
  return projects;
}
