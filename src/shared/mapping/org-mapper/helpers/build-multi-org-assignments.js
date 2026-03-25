// -------- Build Multi-Org Assignments --------
import { assignBindingGroupsToOrgs } from './assign-binding-groups-to-orgs.js';

export function buildMultiOrgAssignments(targetOrgs, bindingGroups, unboundProjects) {
  const orgAssignments = new Map();
  for (const org of targetOrgs) {
    orgAssignments.set(org.key, { org, projects: [], bindingGroups: [] });
  }

  assignBindingGroupsToOrgs(bindingGroups, targetOrgs, orgAssignments);

  if (unboundProjects.length > 0 && targetOrgs.length > 0) {
    orgAssignments.get(targetOrgs[0].key).projects.push(...unboundProjects);
  }

  return orgAssignments;
}
