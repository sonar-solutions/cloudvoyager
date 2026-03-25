import * as qp from '../../api/quality-profiles.js';
import * as qg from '../../api/quality-gates.js';
import * as iss from '../../api/issues.js';
import * as hs from '../../api/hotspots.js'; import * as perms from '../../api/permissions.js';
import * as pc from '../../api/project-config.js';

// -------- Main Logic --------

// Build delegate methods that forward to API sub-modules.
export function buildDelegateMethods(client, organization, projectKey) {
  return {
    async getQualityProfiles() { return qp.getQualityProfiles(client, organization, projectKey); },
    async getMainBranchName() { return qp.getMainBranchName(client, projectKey); },
    async restoreQualityProfile(bk) { return qp.restoreQualityProfile(client, organization, bk); },
    async setDefaultQualityProfile(l, q) { return qp.setDefaultQualityProfile(client, organization, l, q); },
    async addQualityProfileGroupPermission(q, l, g) { return qp.addQualityProfileGroupPermission(client, organization, q, l, g); },
    async addQualityProfileUserPermission(q, l, u) { return qp.addQualityProfileUserPermission(client, organization, q, l, u); },
    async searchQualityProfiles(l = null) { return qp.searchQualityProfiles(client, organization, l); },
    async getActiveRules(pk) { return qp.getActiveRules(client, organization, pk); },
    async getActiveRulesWithCleanCodeFields(pk) { return qp.getActiveRulesWithCleanCodeFields(client, organization, pk); },
    async addQualityProfileToProject(l, q, pk) { return qp.addQualityProfileToProject(client, organization, l, q, pk); },
    async createQualityGate(n) { return qg.createQualityGate(client, organization, n); },
    async createQualityGateCondition(g, m, o, e) { return qg.createQualityGateCondition(client, organization, g, m, o, e); },
    async setDefaultQualityGate(id) { return qg.setDefaultQualityGate(client, organization, id); },
    async assignQualityGateToProject(g, pk) { return qg.assignQualityGateToProject(client, organization, g, pk); },
    async getIssueChangelog(k) { return iss.getIssueChangelog(client, k); },
    async transitionIssue(i, t) { return iss.transitionIssue(client, i, t); },
    async assignIssue(i, a) { return iss.assignIssue(client, i, a); },
    async addIssueComment(i, t) { return iss.addIssueComment(client, i, t); },
    async setIssueTags(i, t) { return iss.setIssueTags(client, i, t); },
    async searchIssues(pk, f = {}) { return iss.searchIssues(client, organization, pk, f); },
    async changeHotspotStatus(h, s, r = null) { return hs.changeHotspotStatus(client, h, s, r); },
    async searchHotspots(pk, f = {}) { return hs.searchHotspots(client, pk, f); },
    async addHotspotComment(h, t) { return hs.addHotspotComment(client, h, t); },
    async createGroup(n, d = '') { return perms.createGroup(client, organization, n, d); },
    async addGroupPermission(g, p) { return perms.addGroupPermission(client, organization, g, p); },
    async addProjectGroupPermission(g, pk, p) { return perms.addProjectGroupPermission(client, organization, g, pk, p); },
    async createPermissionTemplate(n, d = '', p = '') { return perms.createPermissionTemplate(client, organization, n, d, p); },
    async addGroupToTemplate(t, g, p) { return perms.addGroupToTemplate(client, organization, t, g, p); },
    async setDefaultTemplate(t, q = 'TRK') { return perms.setDefaultTemplate(client, organization, t, q); },
    async setProjectSetting(k, v, c = null) { return pc.setProjectSetting(client, k, v, c || projectKey); },
    async setProjectTags(pk, t) { return pc.setProjectTags(client, pk, t); },
    async createProjectLink(pk, n, u) { return pc.createProjectLink(client, pk, n, u); },
    async setGithubBinding(pk, a, r, m = false) { return pc.setGithubBinding(client, pk, a, r, m); },
    async setGitlabBinding(pk, a, r) { return pc.setGitlabBinding(client, pk, a, r); },
    async setAzureBinding(pk, a, p, r) { return pc.setAzureBinding(client, pk, a, p, r); },
    async setBitbucketBinding(pk, a, r, s) { return pc.setBitbucketBinding(client, pk, a, r, s); },
    async searchIssuesWithComments(pk, filters = {}) { return iss.searchIssues(client, organization, pk, { additionalFields: 'comments', ...filters }); },
  };
}
