import * as qual from '../../api/quality.js';
import * as ih from '../../api/issues-hotspots.js';
import * as perm from '../../api/permissions.js';
import * as sc from '../../api/server-config.js';
import { probeTotal } from './probe-total.js';

// -------- Main Logic --------

// Build delegate methods that forward to API sub-modules.
export function buildDelegateMethods(client, projectKey, getPaginatedFn) {
  const gp = getPaginatedFn;
  const probeFn = (ep, params, dk) => probeTotal(client, ep, params, dk);
  return {
    async getIssues(f = {}) { return ih.getIssues(probeFn, gp, projectKey, f); },
    async getIssuesWithComments(f = {}) { return ih.getIssuesWithComments(probeFn, gp, projectKey, f); },
    async getIssueChangelog(k) { return ih.getIssueChangelog(client, k); },
    async getHotspots(f = {}) { return ih.getHotspots(probeFn, gp, projectKey, f); },
    async getHotspotDetails(k) { return ih.getHotspotDetails(client, k); },
    async getQualityGates() { return qual.getQualityGates(client); },
    async getQualityGateDetails(n) { return qual.getQualityGateDetails(client, n); },
    async getQualityGatePermissions(n) { return qual.getQualityGatePermissions(client, n); },
    async getAllQualityProfiles() { return qual.getAllQualityProfiles(client); },
    async getQualityProfileBackup(l, q) { return qual.getQualityProfileBackup(client, l, q); },
    async getQualityProfilePermissions(l, q) { return qual.getQualityProfilePermissions(client, l, q); },
    async getGroups() { return perm.getGroups(gp); },
    async getGlobalPermissions() { return perm.getGlobalPermissions(gp); },
    async getProjectPermissions(pk) { return perm.getProjectPermissions(gp, pk); },
    async getPermissionTemplates() { return perm.getPermissionTemplates(client); },
    async getPortfolios() { return perm.getPortfolios(client); },
    async getPortfolioDetails(k) { return perm.getPortfolioDetails(client, k); },
    async getProjectSettings(pk = null) { return sc.getProjectSettings(client, pk || projectKey); },
    async getServerSettings() { return sc.getServerSettings(client); },
    async getProjectTags(pk = null) { return sc.getProjectTags(client, pk); },
    async getProjectLinks(pk = null) { return sc.getProjectLinks(client, pk || projectKey); },
    async getNewCodePeriods(pk = null) { return sc.getNewCodePeriods(client, pk || projectKey); },
    async getAlmSettings() { return sc.getAlmSettings(client); },
    async getProjectBinding(pk = null) { return sc.getProjectBinding(client, pk || projectKey); },
    async getSystemInfo() { return sc.getSystemInfo(client); },
    async getInstalledPlugins() { return sc.getInstalledPlugins(client); },
    async getWebhooks(pk = null) { return sc.getWebhooks(client, pk); },
  };
}
