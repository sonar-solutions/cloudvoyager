import * as iss from '../../api/issues.js';
import * as hs from '../../api/hotspots.js';
import * as perms from '../../api/permissions.js';
import * as pc from '../../api/project-config.js';

// -------- Delegated Issue, Hotspot, Permission & Config Methods --------

export function bindIssueConfigMethods(c, o, pk) {
  return {
    getIssueChangelog: (k) => iss.getIssueChangelog(c, k),
    transitionIssue: (i, t) => iss.transitionIssue(c, i, t),
    assignIssue: (i, a) => iss.assignIssue(c, i, a),
    addIssueComment: (i, t) => iss.addIssueComment(c, i, t),
    setIssueTags: (i, t) => iss.setIssueTags(c, i, t),
    searchIssues: (p, f = {}) => iss.searchIssues(c, o, p, f),
    changeHotspotStatus: (h, s, r = null) => hs.changeHotspotStatus(c, h, s, r),
    searchHotspots: (p, f = {}) => hs.searchHotspots(c, p, f),
    addHotspotComment: (h, t) => hs.addHotspotComment(c, h, t),
    createGroup: (n, d = '') => perms.createGroup(c, o, n, d),
    addGroupPermission: (g, p) => perms.addGroupPermission(c, o, g, p),
    addProjectGroupPermission: (g, p, perm) => perms.addProjectGroupPermission(c, o, g, p, perm),
    createPermissionTemplate: (n, d = '', p = '') => perms.createPermissionTemplate(c, o, n, d, p),
    addGroupToTemplate: (t, g, p) => perms.addGroupToTemplate(c, o, t, g, p),
    setDefaultTemplate: (t, q = 'TRK') => perms.setDefaultTemplate(c, o, t, q),
    setProjectSetting: (k, v, comp = null) => pc.setProjectSetting(c, k, v, comp || pk),
    setProjectTags: (p, t) => pc.setProjectTags(c, p, t),
    createProjectLink: (p, n, u) => pc.createProjectLink(c, p, n, u),
    setGithubBinding: (p, a, r, m = false) => pc.setGithubBinding(c, p, a, r, m),
    setGitlabBinding: (p, a, r) => pc.setGitlabBinding(c, p, a, r),
    setAzureBinding: (p, a, pr, r) => pc.setAzureBinding(c, p, a, pr, r),
    setBitbucketBinding: (p, a, r, s) => pc.setBitbucketBinding(c, p, a, r, s),
  };
}
