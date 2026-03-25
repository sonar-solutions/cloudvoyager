// -------- Re-export for backward compatibility --------

export {
  getQualityProfiles, getMainBranchName, restoreQualityProfile,
  setDefaultQualityProfile, addQualityProfileGroupPermission,
  addQualityProfileUserPermission, searchQualityProfiles,
  getActiveRules, getActiveRulesWithCleanCodeFields,
  addQualityProfileToProject,
} from './quality-profiles/index.js';
