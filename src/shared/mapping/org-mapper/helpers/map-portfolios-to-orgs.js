// -------- Map Portfolios to Orgs --------
export function mapPortfoliosToOrgs(extractedData, orgAssignments, projectsByOrg, portfoliosByOrg) {
  for (const portfolio of (extractedData.portfolios || [])) {
    for (const a of orgAssignments) {
      const orgProjects = projectsByOrg.get(a.org.key);
      const hasProject = (portfolio.projects || []).some(p => orgProjects.has(p.key));
      if (hasProject) portfoliosByOrg.get(a.org.key).push(portfolio);
    }
  }
}
