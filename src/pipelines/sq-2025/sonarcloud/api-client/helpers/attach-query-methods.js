import * as qm from './query-methods.js';
import * as qm2 from './query-methods-2.js';
import * as qm3 from './query-methods-3.js';
import * as qm4 from './query-methods-4.js';

// -------- Attach Read-Only Query Methods --------

/** Attach all read-only query methods to the client instance. */
export function attachQueryMethods(inst, client, org, pk) {
  inst.getPaginated = (ep, p = {}, dk = 'components') => qm.getPaginated(client, ep, p, dk);
  inst.listProjects = () => qm.listProjects(client, org);
  inst.getProjectBranches = (projKey) => qm.getProjectBranches(client, projKey);
  inst.listQualityGates = () => qm.listQualityGates(client, org);
  inst.getQualityGateDetails = (id) => qm.getQualityGateDetails(client, id, org);
  inst.getQualityGateForProject = (projKey) => qm.getQualityGateForProject(client, projKey, org);
  inst.getProjectMeasures = (projKey, mk) => qm2.getProjectMeasures(client, projKey, mk);
  inst.getProjectSettings = (projKey) => qm2.getProjectSettings(client, projKey);
  inst.getProjectLinks = (projKey) => qm2.getProjectLinks(client, projKey);
  inst.getProjectTagsForProject = (projKey) => qm2.getProjectTagsForProject(client, projKey);
  inst.getNewCodePeriods = (projKey) => qm2.getNewCodePeriods(client, projKey);
  inst.getProjectBinding = (projKey) => qm3.getProjectBinding(client, projKey);
  inst.getGroups = () => qm3.getGroups(client, org);
  inst.getGlobalPermissions = () => qm3.getGlobalPermissions(client, org);
  inst.getProjectPermissions = (projKey) => qm3.getProjectPermissions(client, projKey, org);
  inst.getPermissionTemplates = () => qm3.getPermissionTemplates(client, org);
  inst.searchIssuesWithComments = (projKey, f = {}) => qm4.searchIssuesWithComments(client, org, projKey, f);
  inst.getHotspotDetails = (hk) => qm4.getHotspotDetails(client, hk);
  inst.getRuleRepositories = () => qm4.getRuleRepositories(client);
}
