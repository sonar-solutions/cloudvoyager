// -------- Map Projects to Organizations --------
import logger from '../../../utils/logger.js';
import { groupProjectsByBinding } from './group-projects-by-binding.js';
import { buildSingleOrgAssignments } from './build-single-org-assignments.js';
import { buildMultiOrgAssignments } from './build-multi-org-assignments.js';

export function mapProjectsToOrganizations(projects, bindings, targetOrgs) {
  const { bindingGroups, unboundProjects } = groupProjectsByBinding(projects, bindings);
  logger.info(`Project grouping: ${bindingGroups.size} binding groups, ${unboundProjects.length} unbound projects`);

  const orgAssignments = (targetOrgs.length === 1)
    ? buildSingleOrgAssignments(targetOrgs[0], projects, bindingGroups)
    : buildMultiOrgAssignments(targetOrgs, bindingGroups, unboundProjects);

  return {
    bindingGroups: [...bindingGroups.values()],
    unboundProjects,
    orgAssignments: [...orgAssignments.values()]
  };
}
