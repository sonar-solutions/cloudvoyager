import * as qual from '../../api/quality.js';
import * as ih from '../../api/issues-hotspots.js';
import * as perm from '../../api/permissions.js';
import * as sc from '../../api/server-config.js';
import logger from '../../../../../shared/utils/logger.js';

// -------- Delegate Methods --------

/** Attach delegation methods for quality, issues, permissions, and server config. */
export function attachDelegateMethods(inst) {
  inst.getIssueChangelog = async (k) => ih.getIssueChangelog(inst.client, k);
  inst.getHotspots = async (f = {}) => ih.getHotspots(inst.getPaginated.bind(inst), inst.projectKey, f);
  inst.getHotspotDetails = async (k) => ih.getHotspotDetails(inst.client, k);

  inst.getQualityGates = async () => qual.getQualityGates(inst.client);
  inst.getQualityGateDetails = async (n) => qual.getQualityGateDetails(inst.client, n);
  inst.getQualityGatePermissions = async (n) => qual.getQualityGatePermissions(inst.client, n);
  inst.getAllQualityProfiles = async () => qual.getAllQualityProfiles(inst.client);
  inst.getQualityProfileBackup = async (l, q) => qual.getQualityProfileBackup(inst.client, l, q);
  inst.getQualityProfilePermissions = async (l, q) => qual.getQualityProfilePermissions(inst.client, l, q);

  inst.getGroups = async () => {
    try { return await perm.getGroups(inst.getPaginated.bind(inst)); }
    catch (error) { logger.warn(`Failed to fetch user groups: ${error.message}`); return []; }
  };
  inst.getGlobalPermissions = async () => perm.getGlobalPermissions(inst.getPaginated.bind(inst));
  inst.getProjectPermissions = async (pk) => perm.getProjectPermissions(inst.getPaginated.bind(inst), pk);
  inst.getPermissionTemplates = async () => perm.getPermissionTemplates(inst.client);
  inst.getPortfolios = async () => perm.getPortfolios(inst.client);
  inst.getPortfolioDetails = async (k) => perm.getPortfolioDetails(inst.client, k);

  inst.getProjectSettings = async (pk = null) => sc.getProjectSettings(inst.client, pk || inst.projectKey);
  inst.getServerSettings = async () => sc.getServerSettings(inst.client);
  inst.getProjectTags = async (pk = null) => sc.getProjectTags(inst.client, pk);
  inst.getProjectLinks = async (pk = null) => sc.getProjectLinks(inst.client, pk || inst.projectKey);
  inst.getNewCodePeriods = async (pk = null) => sc.getNewCodePeriods(inst.client, pk || inst.projectKey);
  inst.getAlmSettings = async () => sc.getAlmSettings(inst.client);
  inst.getProjectBinding = async (pk = null) => sc.getProjectBinding(inst.client, pk || inst.projectKey);
  inst.getSystemInfo = async () => sc.getSystemInfo(inst.client);
  inst.getInstalledPlugins = async () => sc.getInstalledPlugins(inst.client);
  inst.getWebhooks = async (pk = null) => sc.getWebhooks(inst.client, pk);
}
