import * as qual from '../../api/quality.js';
import * as ih from '../../api/issues-hotspots.js';
import * as perm from '../../api/permissions.js';
import * as sc from '../../api/server-config.js';

// -------- Bind Delegate Methods to API Sub-Modules --------

export function bindDelegateMethods(client, getPaginatedFn, projectKey) {
  return {
    getIssues: (f = {}) => ih.getIssues(getPaginatedFn, projectKey, f),
    getIssuesWithComments: (f = {}) => ih.getIssuesWithComments(getPaginatedFn, projectKey, f),
    getIssueChangelog: (k) => ih.getIssueChangelog(client, k),
    getHotspots: (f = {}) => ih.getHotspots(getPaginatedFn, projectKey, f),
    getHotspotDetails: (k) => ih.getHotspotDetails(client, k),
    getQualityGates: () => qual.getQualityGates(client),
    getQualityGateDetails: (n) => qual.getQualityGateDetails(client, n),
    getQualityGatePermissions: (n) => qual.getQualityGatePermissions(client, n),
    getAllQualityProfiles: () => qual.getAllQualityProfiles(client),
    getQualityProfileBackup: (l, q) => qual.getQualityProfileBackup(client, l, q),
    getQualityProfilePermissions: (l, q) => qual.getQualityProfilePermissions(client, l, q),
    getGroups: () => perm.getGroups(getPaginatedFn),
    getGlobalPermissions: () => perm.getGlobalPermissions(getPaginatedFn),
    getProjectPermissions: (pk) => perm.getProjectPermissions(getPaginatedFn, pk),
    getPermissionTemplates: () => perm.getPermissionTemplates(client),
    getPortfolios: () => perm.getPortfolios(client),
    getPortfolioDetails: (k) => perm.getPortfolioDetails(client, k),
    getProjectSettings: (pk = null) => sc.getProjectSettings(client, pk || projectKey),
    getServerSettings: () => sc.getServerSettings(client),
    getProjectTags: (pk = null) => sc.getProjectTags(client, pk),
    getProjectLinks: (pk = null) => sc.getProjectLinks(client, pk || projectKey),
    getNewCodePeriods: (pk = null) => sc.getNewCodePeriods(client, pk || projectKey),
    getAlmSettings: () => sc.getAlmSettings(client),
    getProjectBinding: (pk = null) => sc.getProjectBinding(client, pk || projectKey),
    getSystemInfo: () => sc.getSystemInfo(client),
    getInstalledPlugins: () => sc.getInstalledPlugins(client),
    getWebhooks: (pk = null) => sc.getWebhooks(client, pk),
  };
}
