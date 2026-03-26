import * as ih from '../../api/issues-hotspots.js';
import * as qual from '../../api/quality.js';
import * as perm from '../../api/permissions.js';
import * as sc from '../../api/server-config.js';
import { probeTotal } from './probe-total.js';

// -------- Bind Delegated Methods --------

export function bindDelegatedMethods(client, paginate, pk) {
  const probeFn = (ep, params, dk) => probeTotal(client, ep, params, dk);
  return {
    getIssues: (f = {}) => ih.getIssues(probeFn, paginate, pk, f),
    getIssuesWithComments: (f = {}) => ih.getIssuesWithComments(probeFn, paginate, pk, f),
    getIssueChangelog: (k) => ih.getIssueChangelog(client, k),
    getHotspots: (f = {}) => ih.getHotspots(probeFn, paginate, pk, f),
    getHotspotDetails: (k) => ih.getHotspotDetails(client, k),
    getQualityGates: () => qual.getQualityGates(client),
    getQualityGateDetails: (n) => qual.getQualityGateDetails(client, n),
    getQualityGatePermissions: (n) => qual.getQualityGatePermissions(client, n),
    getAllQualityProfiles: () => qual.getAllQualityProfiles(client),
    getQualityProfileBackup: (l, q) => qual.getQualityProfileBackup(client, l, q),
    getQualityProfilePermissions: (l, q) => qual.getQualityProfilePermissions(client, l, q),
    getGroups: () => perm.getGroups(paginate),
    getGlobalPermissions: () => perm.getGlobalPermissions(paginate),
    getProjectPermissions: (p) => perm.getProjectPermissions(paginate, p),
    getPermissionTemplates: () => perm.getPermissionTemplates(client),
    getPortfolios: () => perm.getPortfolios(client),
    getPortfolioDetails: (k) => perm.getPortfolioDetails(client, k),
    getProjectSettings: (p = null) => sc.getProjectSettings(client, p || pk),
    getServerSettings: () => sc.getServerSettings(client),
    getProjectTags: (p = null) => sc.getProjectTags(client, p),
    getProjectLinks: (p = null) => sc.getProjectLinks(client, p || pk),
    getNewCodePeriods: (p = null) => sc.getNewCodePeriods(client, p || pk),
    getAlmSettings: () => sc.getAlmSettings(client),
    getProjectBinding: (p = null) => sc.getProjectBinding(client, p || pk),
    getSystemInfo: () => sc.getSystemInfo(client),
    getInstalledPlugins: () => sc.getInstalledPlugins(client),
    getWebhooks: (p = null) => sc.getWebhooks(client, p),
  };
}
