import { getPaginated } from './get-paginated.js';
import * as qm from './query-methods.js';
import * as qmx from './query-methods-extended.js';

// -------- Bind All Query Methods to Context --------

export function bindQueryMethods(ctx) {
  return {
    getPaginated: (ep, p, dk) => getPaginated(ctx.client, ep, p, dk),
    listProjects: () => qm.listProjects(ctx),
    getProjectBranches: (pk) => qm.getProjectBranches(ctx, pk),
    listQualityGates: () => qm.listQualityGates(ctx),
    getQualityGateDetails: (id) => qm.getQualityGateDetails(ctx, id),
    getQualityGateForProject: (pk) => qm.getQualityGateForProject(ctx, pk),
    getProjectMeasures: (pk, mk) => qm.getProjectMeasures(ctx, pk, mk),
    getProjectSettings: (pk) => qm.getProjectSettings(ctx, pk),
    getProjectLinks: (pk) => qm.getProjectLinks(ctx, pk),
    getProjectTagsForProject: (pk) => qm.getProjectTagsForProject(ctx, pk),
    getNewCodePeriods: (pk) => qmx.getNewCodePeriods(ctx, pk),
    getProjectBinding: (pk) => qmx.getProjectBinding(ctx, pk),
    getGroups: () => qmx.getGroups(ctx),
    getGlobalPermissions: () => qmx.getGlobalPermissions(ctx),
    getProjectPermissions: (pk) => qmx.getProjectPermissions(ctx, pk),
    getPermissionTemplates: () => qmx.getPermissionTemplates(ctx),
    searchIssuesWithComments: (pk, f) => qmx.searchIssuesWithComments(ctx, pk, f),
    getHotspotDetails: (hk) => qmx.getHotspotDetails(ctx, hk),
    getRuleRepositories: () => qmx.getRuleRepositories(ctx),
  };
}
