// -------- Map Resources to Organizations --------
import { initOrgResourceMaps } from './init-org-resource-maps.js';
import { mapPortfoliosToOrgs } from './map-portfolios-to-orgs.js';

export function mapResourcesToOrganizations(extractedData, orgAssignments) {
  const { gatesByOrg, profilesByOrg, groupsByOrg, portfoliosByOrg, templatesByOrg } = initOrgResourceMaps(extractedData, orgAssignments);
  const projectsByOrg = new Map();
  for (const a of orgAssignments) projectsByOrg.set(a.org.key, new Set(a.projects.map(p => p.key)));

  // All quality gates and profiles go to all orgs (server-wide)
  for (const a of orgAssignments) {
    gatesByOrg.set(a.org.key, [...(extractedData.qualityGates || [])]);
    profilesByOrg.set(a.org.key, [...(extractedData.qualityProfiles || [])]);
  }

  mapPortfoliosToOrgs(extractedData, orgAssignments, projectsByOrg, portfoliosByOrg);
  return { gatesByOrg, profilesByOrg, groupsByOrg, portfoliosByOrg, templatesByOrg };
}
