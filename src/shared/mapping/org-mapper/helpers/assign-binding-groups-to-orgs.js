// -------- Assign Binding Groups to Orgs --------
export function assignBindingGroupsToOrgs(bindingGroups, targetOrgs, orgAssignments) {
  for (const [groupKey, group] of bindingGroups) {
    const matchingOrg = targetOrgs.find(org =>
      groupKey.toLowerCase().includes(org.key.toLowerCase())
    );
    const targetOrg = matchingOrg || targetOrgs[0];
    if (targetOrg) {
      orgAssignments.get(targetOrg.key).projects.push(...group.projects);
      orgAssignments.get(targetOrg.key).bindingGroups.push(group);
    }
  }
}
