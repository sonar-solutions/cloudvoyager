import * as qp from '../../api/quality-profiles.js';
import * as qg from '../../api/quality-gates.js';
import * as iss from '../../api/issues.js';
import * as hs from '../../api/hotspots.js';
import * as perms from '../../api/permissions.js';
import * as pc from '../../api/project-config.js';

// -------- Bind Delegate Methods to Context --------

export function bindDelegateMethods(ctx) {
  return {
    getQualityProfiles: () => qp.getQualityProfiles(ctx.client, ctx.organization, ctx.projectKey),
    getMainBranchName: () => qp.getMainBranchName(ctx.client, ctx.projectKey),
    restoreQualityProfile: (bk) => qp.restoreQualityProfile(ctx.client, ctx.organization, bk),
    setDefaultQualityProfile: (l, q) => qp.setDefaultQualityProfile(ctx.client, ctx.organization, l, q),
    addQualityProfileGroupPermission: (q, l, g) => qp.addQualityProfileGroupPermission(ctx.client, ctx.organization, q, l, g),
    addQualityProfileUserPermission: (q, l, u) => qp.addQualityProfileUserPermission(ctx.client, ctx.organization, q, l, u),
    searchQualityProfiles: (l) => qp.searchQualityProfiles(ctx.client, ctx.organization, l),
    getActiveRules: (pk) => qp.getActiveRules(ctx.client, ctx.organization, pk),
    getActiveRulesWithCleanCodeFields: (pk) => qp.getActiveRulesWithCleanCodeFields(ctx.client, ctx.organization, pk),
    addQualityProfileToProject: (l, q, pk) => qp.addQualityProfileToProject(ctx.client, ctx.organization, l, q, pk),
    createQualityGate: (n) => qg.createQualityGate(ctx.client, ctx.organization, n),
    createQualityGateCondition: (g, m, o, e) => qg.createQualityGateCondition(ctx.client, ctx.organization, g, m, o, e),
    setDefaultQualityGate: (id) => qg.setDefaultQualityGate(ctx.client, ctx.organization, id),
    assignQualityGateToProject: (g, pk) => qg.assignQualityGateToProject(ctx.client, ctx.organization, g, pk),
    getIssueChangelog: (k) => iss.getIssueChangelog(ctx.client, k),
    transitionIssue: (i, t) => iss.transitionIssue(ctx.client, i, t),
    assignIssue: (i, a) => iss.assignIssue(ctx.client, i, a),
    addIssueComment: (i, t) => iss.addIssueComment(ctx.client, i, t),
    setIssueTags: (i, t) => iss.setIssueTags(ctx.client, i, t),
    searchIssues: (pk, f) => iss.searchIssues(ctx.client, ctx.organization, pk, f),
    changeHotspotStatus: (h, s, r) => hs.changeHotspotStatus(ctx.client, h, s, r),
    searchHotspots: (pk, f) => hs.searchHotspots(ctx.client, pk, f),
    addHotspotComment: (h, t) => hs.addHotspotComment(ctx.client, h, t),
    createGroup: (n, d) => perms.createGroup(ctx.client, ctx.organization, n, d),
    addGroupPermission: (g, p) => perms.addGroupPermission(ctx.client, ctx.organization, g, p),
    addProjectGroupPermission: (g, pk, p) => perms.addProjectGroupPermission(ctx.client, ctx.organization, g, pk, p),
    createPermissionTemplate: (n, d, p) => perms.createPermissionTemplate(ctx.client, ctx.organization, n, d, p),
    addGroupToTemplate: (t, g, p) => perms.addGroupToTemplate(ctx.client, ctx.organization, t, g, p),
    setDefaultTemplate: (t, q) => perms.setDefaultTemplate(ctx.client, ctx.organization, t, q),
    setProjectSetting: (k, v, c) => pc.setProjectSetting(ctx.client, k, v, c || ctx.projectKey),
    setProjectTags: (pk, t) => pc.setProjectTags(ctx.client, pk, t),
    createProjectLink: (pk, n, u) => pc.createProjectLink(ctx.client, pk, n, u),
    setGithubBinding: (pk, a, r, m) => pc.setGithubBinding(ctx.client, pk, a, r, m),
    setGitlabBinding: (pk, a, r) => pc.setGitlabBinding(ctx.client, pk, a, r),
    setAzureBinding: (pk, a, p, r) => pc.setAzureBinding(ctx.client, pk, a, p, r),
    setBitbucketBinding: (pk, a, r, s) => pc.setBitbucketBinding(ctx.client, pk, a, r, s),
  };
}
