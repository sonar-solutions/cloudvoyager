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
  // Group projects by their DevOps binding org/group
  const bindingGroups = new Map();
  const unboundProjects = [];

  for (const project of projects) {
    const binding = bindings.get(project.key);

    if (binding) {
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
    } else {
      unboundProjects.push(project);
    }
  }

  logger.info(`Project grouping: ${bindingGroups.size} binding groups, ${unboundProjects.length} unbound projects`);

  // Map binding groups to target organizations
  const orgAssignments = new Map(); // orgKey -> { org, projects, bindingGroup }

  if (targetOrgs.length === 1) {
    // Single target org: all projects go there
    const org = targetOrgs[0];
    orgAssignments.set(org.key, {
      org,
      projects: [...projects],
      bindingGroups: [...bindingGroups.values()]
    });
  } else {
    // Multiple target orgs: match by binding group
    // Default: first org gets unbound projects
    for (const org of targetOrgs) {
      orgAssignments.set(org.key, {
        org,
        projects: [],
        bindingGroups: []
      });
    }

    // Assign binding groups to orgs (by matching org key to binding identifier)
    for (const [groupKey, group] of bindingGroups) {
      let assigned = false;
      for (const org of targetOrgs) {
        if (groupKey.toLowerCase().includes(org.key.toLowerCase())) {
          orgAssignments.get(org.key).projects.push(...group.projects);
          orgAssignments.get(org.key).bindingGroups.push(group);
          assigned = true;
          break;
        }
      }

      // If no match, assign to first org
      if (!assigned && targetOrgs.length > 0) {
        const defaultOrg = targetOrgs[0];
        orgAssignments.get(defaultOrg.key).projects.push(...group.projects);
        orgAssignments.get(defaultOrg.key).bindingGroups.push(group);
      }
    }

    // Assign unbound projects to first org
    if (unboundProjects.length > 0 && targetOrgs.length > 0) {
      orgAssignments.get(targetOrgs[0].key).projects.push(...unboundProjects);
    }
  }

  return {
    bindingGroups: [...bindingGroups.values()],
    unboundProjects,
    orgAssignments: [...orgAssignments.values()]
  };
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
