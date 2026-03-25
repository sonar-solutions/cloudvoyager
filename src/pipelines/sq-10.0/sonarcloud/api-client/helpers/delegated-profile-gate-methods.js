import * as qp from '../../api/quality-profiles.js';
import * as qg from '../../api/quality-gates.js';

// -------- Delegated Quality Profile & Gate Methods --------

export function bindProfileGateMethods(c, o, pk) {
  return {
    getQualityProfiles: () => qp.getQualityProfiles(c, o, pk),
    getMainBranchName: () => qp.getMainBranchName(c, pk),
    restoreQualityProfile: (bk) => qp.restoreQualityProfile(c, o, bk),
    setDefaultQualityProfile: (l, q) => qp.setDefaultQualityProfile(c, o, l, q),
    addQualityProfileGroupPermission: (q, l, g) => qp.addQualityProfileGroupPermission(c, o, q, l, g),
    addQualityProfileUserPermission: (q, l, u) => qp.addQualityProfileUserPermission(c, o, q, l, u),
    searchQualityProfiles: (l = null) => qp.searchQualityProfiles(c, o, l),
    getActiveRules: (p) => qp.getActiveRules(c, o, p),
    getActiveRulesWithCleanCodeFields: (p) => qp.getActiveRulesWithCleanCodeFields(c, o, p),
    addQualityProfileToProject: (l, q, p) => qp.addQualityProfileToProject(c, o, l, q, p),
    createQualityGate: (n) => qg.createQualityGate(c, o, n),
    createQualityGateCondition: (g, m, op, e) => qg.createQualityGateCondition(c, o, g, m, op, e),
    setDefaultQualityGate: (id) => qg.setDefaultQualityGate(c, o, id),
    assignQualityGateToProject: (g, p) => qg.assignQualityGateToProject(c, o, g, p),
  };
}
