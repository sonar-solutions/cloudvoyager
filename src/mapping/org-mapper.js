import logger from '../utils/logger.js';

/**
 * Map projects to target SonarCloud organizations based on DevOps bindings.
 * Projects are grouped by their DevOps platform binding (GitHub org, GitLab group, etc.)
 * combined with the server URL to determine target organizations.
 *
 * @param {Array} projects - All projects from SonarQube
 * @param {Map<string, object>} bindings - Project key -> DevOps binding
 * @param {Array} targetOrgs - Configured target SonarCloud organizations
 * @returns {object} Organization mapping result
 */
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

function groupProjectsByBinding(projects, bindings) {
  const bindingGroups = new Map();
  const unboundProjects = [];

  for (const project of projects) {
    const binding = bindings.get(project.key);

    if (!binding) {
      unboundProjects.push(project);
      continue;
    }

    const groupKey = buildBindingGroupKey(binding);
    if (!bindingGroups.has(groupKey)) {
      bindingGroups.set(groupKey, {
        alm: binding.alm,
        identifier: groupKey,
        url: binding.url || '',
        projects: []
      });
    }
    bindingGroups.get(groupKey).projects.push(project);
  }

  return { bindingGroups, unboundProjects };
}

function buildSingleOrgAssignments(org, projects, bindingGroups) {
  const orgAssignments = new Map();
  orgAssignments.set(org.key, {
    org,
    projects: [...projects],
    bindingGroups: [...bindingGroups.values()]
  });
  return orgAssignments;
}

function buildMultiOrgAssignments(targetOrgs, bindingGroups, unboundProjects) {
  const orgAssignments = new Map();

  for (const org of targetOrgs) {
    orgAssignments.set(org.key, { org, projects: [], bindingGroups: [] });
  }

  assignBindingGroupsToOrgs(bindingGroups, targetOrgs, orgAssignments);

  // Assign unbound projects to first org
  if (unboundProjects.length > 0 && targetOrgs.length > 0) {
    orgAssignments.get(targetOrgs[0].key).projects.push(...unboundProjects);
  }

  return orgAssignments;
}

function assignBindingGroupsToOrgs(bindingGroups, targetOrgs, orgAssignments) {
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

/**
 * Build a group key from a DevOps binding
 * Groups projects by the org/group they belong to on the DevOps platform
 */
function buildBindingGroupKey(binding) {
  const repo = binding.repository || binding.slug || '';

  switch (binding.alm) {
  case 'github': {
    // GitHub repos: "org/repo" -> extract org
    const parts = repo.split('/');
    return parts.length > 1 ? `github:${parts[0]}` : `github:${repo}`;
  }
  case 'gitlab': {
    // GitLab repos: "group/subgroup/project" -> extract group
    const parts = repo.split('/');
    return parts.length > 1 ? `gitlab:${parts[0]}` : `gitlab:${repo}`;
  }
  case 'azure': {
    // Azure DevOps: use project name
    return `azure:${binding.repository || binding.slug || 'default'}`;
  }
  case 'bitbucket':
  case 'bitbucketcloud': {
    // Bitbucket: "workspace/repo" -> extract workspace
    const parts = (binding.slug || repo).split('/');
    return parts.length > 1 ? `bitbucket:${parts[0]}` : `bitbucket:${binding.slug || repo}`;
  }
  default:
    return `${binding.alm}:${repo}`;
  }
}

/**
 * Map quality gates/profiles/groups/portfolios/templates to target organizations
 * based on which projects use them
 *
 * @param {object} extractedData - All extracted data
 * @param {Array} orgAssignments - Organization assignments from mapProjectsToOrganizations
 * @returns {object} Mappings for each data type to organizations
 */
export function mapResourcesToOrganizations(extractedData, orgAssignments) {
  const projectsByOrg = new Map();
  for (const assignment of orgAssignments) {
    const projectKeys = new Set(assignment.projects.map(p => p.key));
    projectsByOrg.set(assignment.org.key, projectKeys);
  }

  // Map gates: a gate is needed by an org if any of its assigned projects use it
  const gatesByOrg = new Map();
  const profilesByOrg = new Map();
  const groupsByOrg = new Map();
  const portfoliosByOrg = new Map();
  const templatesByOrg = new Map();

  for (const assignment of orgAssignments) {
    gatesByOrg.set(assignment.org.key, []);
    profilesByOrg.set(assignment.org.key, []);
    groupsByOrg.set(assignment.org.key, [...(extractedData.groups || [])]);
    portfoliosByOrg.set(assignment.org.key, []);
    templatesByOrg.set(assignment.org.key, [...(extractedData.permissionTemplates?.templates || [])]);
  }

  // All quality gates and profiles go to all orgs (they're server-wide)
  for (const assignment of orgAssignments) {
    gatesByOrg.set(assignment.org.key, [...(extractedData.qualityGates || [])]);
    profilesByOrg.set(assignment.org.key, [...(extractedData.qualityProfiles || [])]);
  }

  // Map portfolios to orgs based on their contained projects
  for (const portfolio of (extractedData.portfolios || [])) {
    for (const assignment of orgAssignments) {
      const orgProjects = projectsByOrg.get(assignment.org.key);
      const hasProject = portfolio.projects.some(p => orgProjects.has(p.key));
      if (hasProject) {
        portfoliosByOrg.get(assignment.org.key).push(portfolio);
      }
    }
  }

  return { gatesByOrg, profilesByOrg, groupsByOrg, portfoliosByOrg, templatesByOrg };
}
