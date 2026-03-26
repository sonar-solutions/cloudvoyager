import { createSonarQubeClient } from './helpers/create-sonarqube-client.js';

// -------- Main Logic --------

export { createSonarQubeClient };

// Thin class wrapper for backward compatibility.
// Prototype placeholders allow sinon.stub() to work on the prototype.
// The constructor skips overwriting any method that has been replaced
// by a test stub (detected via sinon's isSinonProxy flag).
export class SonarQubeClient {
  constructor(config) {
    const instance = createSonarQubeClient(config);
    for (const [key, value] of Object.entries(instance)) {
      if (typeof value === 'function' && typeof this[key]?.isSinonProxy !== 'undefined') continue;
      this[key] = value;
    }
  }

  // Prototype method placeholders — overwritten by factory
  // unless a test stub replaces them first.
  handleError() {}
  testConnection() {}
  getServerVersion() {}
  getProject() {}
  getBranches() {}
  getQualityGate() {}
  getMetrics() {}
  getSourceCode() {}
  getSourceFiles() {}
  getQualityProfiles() {}
  getActiveRules() {}
  getDuplications() {}
  getMeasures() {}
  getComponentTree() {}
  getLatestAnalysisRevision() {}
  listAllProjects() {}
  getIssues() {}
  getIssuesWithComments() {}
  getIssueChangelog() {}
  getHotspots() {}
  getHotspotDetails() {}
  getQualityGates() {}
  getQualityGateDetails() {}
  getQualityGatePermissions() {}
  getAllQualityProfiles() {}
  getQualityProfileBackup() {}
  getQualityProfilePermissions() {}
  getGroups() {}
  getGlobalPermissions() {}
  getProjectPermissions() {}
  getPermissionTemplates() {}
  getPortfolios() {}
  getPortfolioDetails() {}
  getProjectSettings() {}
  getServerSettings() {}
  getProjectTags() {}
  getProjectLinks() {}
  getNewCodePeriods() {}
  getAlmSettings() {}
  getProjectBinding() {}
  getSystemInfo() {}
  getInstalledPlugins() {}
  getWebhooks() {}
}
