import { buildAndUpload } from './helpers/build-and-upload.js';
import { computeBranchStats } from './helpers/compute-branch-stats.js';

// -------- Transfer Branch --------

/** Build, encode, and upload a single branch report to SonarCloud. */
export async function transferBranch(options) {
  const { extractedData, sonarcloudConfig, sonarCloudProfiles,
    branchName, referenceBranchName, wait, sonarCloudClient,
    label, isMainBranch = false, sonarCloudRepos = new Set(),
    ruleEnrichmentMap = new Map() } = options;

  const ceTask = await buildAndUpload({
    extractedData, sonarcloudConfig, sonarCloudProfiles,
    branchName, referenceBranchName, sonarCloudRepos,
    ruleEnrichmentMap, isMainBranch, wait, sonarCloudClient, label,
  });

  return { stats: computeBranchStats(extractedData), ceTask };
}
