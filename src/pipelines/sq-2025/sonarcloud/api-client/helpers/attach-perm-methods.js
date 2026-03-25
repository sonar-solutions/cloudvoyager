import * as perms from '../../api/permissions.js';
import * as pc from '../../api/project-config.js';

// -------- Attach Permission and Project Config Delegation Methods --------

/** Attach permission and project config API methods to the client instance. */
export function attachPermMethods(inst, client, org, pk) {
  inst.createGroup = (n, d = '') => perms.createGroup(client, org, n, d);
  inst.addGroupPermission = (g, p) => perms.addGroupPermission(client, org, g, p);
  inst.addProjectGroupPermission = (g, projKey, p) => perms.addProjectGroupPermission(client, org, g, projKey, p);
  inst.createPermissionTemplate = (n, d = '', p = '') => perms.createPermissionTemplate(client, org, n, d, p);
  inst.addGroupToTemplate = (t, g, p) => perms.addGroupToTemplate(client, org, t, g, p);
  inst.setDefaultTemplate = (t, q = 'TRK') => perms.setDefaultTemplate(client, org, t, q);
  inst.setProjectSetting = (k, v, c = null) => pc.setProjectSetting(client, k, v, c || pk);
  inst.setProjectTags = (projKey, t) => pc.setProjectTags(client, projKey, t);
  inst.createProjectLink = (projKey, n, u) => pc.createProjectLink(client, projKey, n, u);
  inst.setGithubBinding = (projKey, a, r, m = false) => pc.setGithubBinding(client, projKey, a, r, m);
  inst.setGitlabBinding = (projKey, a, r) => pc.setGitlabBinding(client, projKey, a, r);
  inst.setAzureBinding = (projKey, a, p, r) => pc.setAzureBinding(client, projKey, a, p, r);
  inst.setBitbucketBinding = (projKey, a, r, s) => pc.setBitbucketBinding(client, projKey, a, r, s);
}
