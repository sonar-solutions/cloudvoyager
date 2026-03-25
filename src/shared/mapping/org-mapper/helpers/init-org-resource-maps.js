// -------- Initialize Per-Org Resource Maps --------
export function initOrgResourceMaps(extractedData, orgAssignments) {
  const gatesByOrg = new Map();
  const profilesByOrg = new Map();
  const groupsByOrg = new Map();
  const portfoliosByOrg = new Map();
  const templatesByOrg = new Map();

  for (const a of orgAssignments) {
    gatesByOrg.set(a.org.key, []);
    profilesByOrg.set(a.org.key, []);
    groupsByOrg.set(a.org.key, [...(extractedData.groups || [])]);
    portfoliosByOrg.set(a.org.key, []);
    templatesByOrg.set(a.org.key, [...(extractedData.permissionTemplates?.templates || [])]);
  }

  return { gatesByOrg, profilesByOrg, groupsByOrg, portfoliosByOrg, templatesByOrg };
}
