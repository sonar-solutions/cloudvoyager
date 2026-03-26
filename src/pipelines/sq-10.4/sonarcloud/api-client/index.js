import { createSonarCloudClient } from './helpers/create-sonarcloud-client.js';

// -------- Main Logic --------

export { createSonarCloudClient };

// Thin class wrapper for backward compatibility.
// Uses prototype-aware assignment so sinon stubs work.
export class SonarCloudClient {
  constructor(config) {
    const instance = createSonarCloudClient(config);
    for (const [key, value] of Object.entries(instance)) {
      if (typeof value === 'function' && typeof this[key]?.isSinonProxy !== 'undefined') continue;
      this[key] = value;
    }
  }

  // Prototype method placeholders — overwritten by factory
  // unless a test stub replaces them first.
  handleError() {}
  testConnection() {}
  projectExists() {}
  isProjectKeyTakenGlobally() {}
  ensureProject() {}
  getMostRecentCeTask() {}
  getAnalysisStatus() {}
  waitForAnalysis() {}
  getQualityProfiles() {}
  getMainBranchName() {}
  createGroup() {}
  addGroupPermission() {}
  createQualityGate() {}
  createQualityGateCondition() {}
  setDefaultQualityGate() {}
  assignQualityGateToProject() {}
  restoreQualityProfile() {}
  setDefaultQualityProfile() {}
  addQualityProfileGroupPermission() {}
  addQualityProfileUserPermission() {}
  addQualityProfileToProject() {}
  createPermissionTemplate() {}
  addGroupToTemplate() {}
  setDefaultTemplate() {}
  addProjectGroupPermission() {}
  getActiveRules() {}
  searchQualityProfiles() {}
  searchIssues() {}
  searchHotspots() {}
  transitionIssue() {}
  addIssueComment() {}
  assignIssue() {}
  setIssueTags() {}
  changeHotspotStatus() {}
  addHotspotComment() {}
  setProjectSetting() {}
  setProjectTags() {}
  createProjectLink() {}
  setGithubBinding() {}
  setGitlabBinding() {}
  setAzureBinding() {}
  setBitbucketBinding() {}
}
