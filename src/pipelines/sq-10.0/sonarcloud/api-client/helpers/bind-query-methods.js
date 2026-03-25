import * as qm from './query-methods.js';
import * as pqm from './project-query-methods.js';
import * as perm from './permission-query-methods.js';

// -------- Bind Query Methods to Client Context --------

export function bindQueryMethods(c, o, pk) {
  return {
    getPaginated: (ep, p, dk) => qm.getPaginated(c, ep, p, dk),
    getProjectBranches: (p) => qm.getProjectBranches(c, p),
    listQualityGates: () => qm.listQualityGates(c, o),
    getQualityGateDetails: (id) => qm.getQualityGateDetails(c, id, o),
    getQualityGateForProject: (p) => qm.getQualityGateForProject(c, p, o),
    getProjectMeasures: (p, mk) => pqm.getProjectMeasures(c, p, mk),
    getProjectSettings: (p) => pqm.getProjectSettings(c, p),
    getProjectLinks: (p) => pqm.getProjectLinks(c, p),
    getProjectTagsForProject: (p) => pqm.getProjectTagsForProject(c, p),
    getNewCodePeriods: (p) => pqm.getNewCodePeriods(c, p),
    getProjectBinding: (p) => pqm.getProjectBinding(c, p),
    getHotspotDetails: (h) => pqm.getHotspotDetails(c, h),
    listProjects: () => perm.listProjects(c, o),
    getGroups: () => perm.getGroups(c, o),
    getGlobalPermissions: () => perm.getGlobalPermissions(c, o),
    getProjectPermissions: (p) => perm.getProjectPermissions(c, p, o),
    getPermissionTemplates: () => perm.getPermissionTemplates(c, o),
    searchIssuesWithComments: (p, f) => perm.searchIssuesWithComments(c, o, p, f),
    getRuleRepositories: () => perm.getRuleRepositories(c),
  };
}
