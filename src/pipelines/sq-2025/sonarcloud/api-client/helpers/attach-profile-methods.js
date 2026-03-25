import * as qp from '../../api/quality-profiles.js';

// -------- Attach Quality Profile Delegation Methods --------

/** Attach quality profile API methods to the client instance. */
export function attachProfileMethods(inst, client, org, pk) {
  inst.getQualityProfiles = () => qp.getQualityProfiles(client, org, pk);
  inst.getMainBranchName = () => qp.getMainBranchName(client, pk);
  inst.restoreQualityProfile = (bk) => qp.restoreQualityProfile(client, org, bk);
  inst.setDefaultQualityProfile = (l, q) => qp.setDefaultQualityProfile(client, org, l, q);
  inst.addQualityProfileGroupPermission = (q, l, g) => qp.addQualityProfileGroupPermission(client, org, q, l, g);
  inst.addQualityProfileUserPermission = (q, l, u) => qp.addQualityProfileUserPermission(client, org, q, l, u);
  inst.searchQualityProfiles = (l = null) => qp.searchQualityProfiles(client, org, l);
  inst.getActiveRules = (profileKey) => qp.getActiveRules(client, org, profileKey);
  inst.getActiveRulesWithCleanCodeFields = (profileKey) => qp.getActiveRulesWithCleanCodeFields(client, org, profileKey);
  inst.addQualityProfileToProject = (l, q, projKey) => qp.addQualityProfileToProject(client, org, l, q, projKey);
}
