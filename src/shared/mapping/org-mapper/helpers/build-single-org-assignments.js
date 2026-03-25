// -------- Build Single Org Assignments --------
export function buildSingleOrgAssignments(org, projects, bindingGroups) {
  const orgAssignments = new Map();
  orgAssignments.set(org.key, {
    org,
    projects: [...projects],
    bindingGroups: [...bindingGroups.values()]
  });
  return orgAssignments;
}
